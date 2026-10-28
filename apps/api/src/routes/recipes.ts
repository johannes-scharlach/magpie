import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { Hono } from "hono";
import { z } from "zod";

import type { AppBindings } from "../auth.js";
import { pool } from "../db.js";
import { env } from "../env.js";
import { locales, RecipeSchema, type Locale } from "../recipe-schema.js";
import { MEAL_SLOTS } from "../plan.js";
import {
  cancelImport,
  completeImport,
  confirmImport,
  findCompletedImport,
  readImportMeasurements,
  readImportVocabulary,
} from "../import-and-plan.js";
import { contentSource } from "../import-identity.js";
import type { ImportRequest } from "../import-request.js";
import { AppError } from "../errors.js";
import { posthogApiLogger } from "../posthog-logs.js";
import {
  fetchRecipePage,
  geminiSeesOnlyAShell,
  recipePageText,
} from "../recipe-page.js";
import { importSource } from "../recipe-source.js";
import {
  extractedRecipe,
  extractedRecipes,
  extractionInstructions,
  RecipesFoundSchema,
  respond,
  respondWithRecipes,
} from "../recipe-extraction.js";

const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey });

const FromUrlSchema = z.object({
  url: z.url(),
  operationId: z.uuid(),
  listId: z.uuid().optional(),
  plan: z
    .object({
      listId: z.string(),
      date: z.iso.date(),
      slot: z.enum(MEAL_SLOTS),
    })
    .optional(),
  context: z.string().optional(),
  locale: z.enum(locales).optional().default("en"),
});

// Enough for a short cookbook pasted whole, or a sitting's worth of pages.
const MAX_TEXT = 200_000;
const MAX_PHOTOS = 20;
const MAX_PHOTO_BYTES = 10_000_000;

const FromContentSchema = z.object({
  operationId: z.uuid(),
  listId: z.uuid(),
  text: z.string().trim().max(MAX_TEXT).optional(),
  locale: z.enum(locales).optional().default("en"),
  // Both or neither: the meal slot to plan the recipe into.
  date: z.iso.date().optional(),
  slot: z.enum(MEAL_SLOTS).optional(),
});

export const recipes = new Hono<AppBindings>();

recipes.post("/import-from-url", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = FromUrlSchema.safeParse(body);
  if (!parsed.success) {
    console.error("Invalid import request:", parsed.error.flatten());
    throw new AppError(
      "INVALID_REQUEST",
      "Check the recipe URL and meal slot.",
      400,
    );
  }
  const request = parsed.data;
  return c.json(
    await logFailure(
      {
        operation_id: request.operationId,
        source: "url",
        target: request.plan ? "plan" : "cookbook",
        url_host: new URL(request.url).host,
      },
      () => importFromUrl(c.get("user").id, request),
    ),
  );
});

/** Pasted text, photos of pages in order, or both. One complete recipe is
 *  saved; more wait for review (ADR 35). */
recipes.post("/import-from-content", async (c) => {
  const body = await c.req.parseBody({ all: true }).catch(() => null);
  const parsed = FromContentSchema.safeParse(body);
  const photos = [body?.photos ?? []].flat();
  if (
    !parsed.success ||
    !parsed.data.date !== !parsed.data.slot ||
    (!parsed.data.text && photos.length === 0) ||
    photos.length > MAX_PHOTOS ||
    !photos.every(
      (p) =>
        p instanceof File &&
        p.type.startsWith("image/") &&
        p.size <= MAX_PHOTO_BYTES,
    )
  ) {
    throw new AppError(
      "INVALID_REQUEST",
      `Paste recipes or choose up to ${MAX_PHOTOS} photos.`,
      400,
    );
  }
  const files = photos as File[];
  const request = parsed.data;
  return c.json(
    await logFailure(
      {
        operation_id: request.operationId,
        source: files.length ? "photos" : "text",
        target: request.slot ? "plan" : "cookbook",
        text_length: request.text?.length ?? 0,
        photo_count: files.length,
        photo_bytes: files.reduce((sum, p) => sum + p.size, 0),
      },
      () => importFromContent(c.get("user").id, request, files),
    ),
  );
});

/** Stops an import from being saved, on whichever machine it runs. The model
 *  call is not interrupted. Reports the recipe if the save came first. */
recipes.post("/imports/:operationId/cancel", async (c) => {
  const operationId = z.uuid().safeParse(c.req.param("operationId"));
  if (!operationId.success)
    throw new AppError("INVALID_REQUEST", "Unknown import.", 400);
  return c.json(await cancelImport(c.get("user").id, operationId.data));
});

/** Saves the recipes the cook kept from a review. Discarding is a cancel. */
recipes.post("/imports/:operationId/confirm", async (c) => {
  const operationId = z.uuid().safeParse(c.req.param("operationId"));
  const body = z
    .object({ keep: z.array(z.number().int().min(0)).min(1) })
    .safeParse(await c.req.json().catch(() => null));
  if (!operationId.success || !body.success)
    throw new AppError("INVALID_REQUEST", "Choose at least one recipe.", 400);
  return c.json(
    await confirmImport(c.get("user").id, operationId.data, [
      ...new Set(body.data.keep),
    ]),
  );
});

/** Logs a failed import with the reason, then lets the error through. */
async function logFailure<T>(
  attributes: Record<string, string | number>,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await run();
  } catch (error) {
    posthogApiLogger.warn("recipe import failed", {
      operation: "recipe_import",
      outcome: "failure",
      ...attributes,
      code: error instanceof AppError ? error.code : "INTERNAL_ERROR",
      reason: failureReason(error),
      duration_ms: Date.now() - startedAt,
    });
    throw error;
  }
}

/** Gemini's own words for extraction failures; the error message otherwise. */
function failureReason(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return typeof error.cause === "string" ? error.cause : error.message;
}

async function importFromUrl(
  userId: string,
  { url, ...rest }: z.infer<typeof FromUrlSchema>,
) {
  const request: ImportRequest = { ...rest, source: url };
  const existing = await findCompletedImport(userId, request);
  if (existing) return existing;
  const locale: Locale = request.locale;

  const measurements = await readImportMeasurements(pool, userId, request);
  const vocabulary = await readImportVocabulary(pool, userId, request);
  const instructions = `${extractionInstructions(locale, measurements, vocabulary)}\nIf the source contains multiple recipes, pick the one that seems most relevant based on this additional context: ${request.context ?? ""}`;
  const fetchItself = (gemini: Record<string, string>) => {
    posthogApiLogger.info("recipe import fetched the page itself", {
      operation: "recipe_import",
      operation_id: request.operationId,
      url_host: new URL(url).host,
      ...gemini,
    });
    return fetchRecipePage(url).then((html) =>
      generateRecipe(
        `Extract the recipe from the page content below into the recipe fields. ${instructions}\n\nURL: ${url}\n\nPage content:\n${recipePageText(html)}\n\n${respond(locale)}`,
        { fetchUrl: false },
      ),
    );
  };

  let result;
  if (geminiSeesOnlyAShell(url)) {
    result = await fetchItself({ gemini_retrieval: "skipped" });
  } else {
    result = await generateRecipe(
      `Fetch the recipe content from the following URL and extract it into the recipe fields. ${instructions}\n\nURL: ${url}\n\n${respond(locale)}`,
      { fetchUrl: true },
    );
    // Some sites block Google's fetcher but not an ordinary request, and some
    // show it a page without the recipe.
    const retrieval = urlRetrievalStatus(result);
    // Reading output after a refusal throws, so only a finished answer counts.
    const geminiError =
      result.finishReason === "stop" ? modelError(result.output) : undefined;
    if (retrieval !== "URL_RETRIEVAL_STATUS_SUCCESS" || geminiError) {
      result = await fetchItself({
        gemini_retrieval: retrieval ?? "none",
        gemini_error: geminiError ?? "none",
      });
    }
  }

  const recipe = extractedRecipe(
    result,
    "Could not read a recipe from that URL.",
  );
  return completeImport(userId, request, {
    save: { ...recipe, from: importSource(url, recipe.from) },
  });
}

async function importFromContent(
  userId: string,
  { text, date, slot, ...fields }: z.infer<typeof FromContentSchema>,
  files: File[],
) {
  const photos = await Promise.all(
    files.map(async (file) => ({
      data: new Uint8Array(await file.arrayBuffer()),
      mediaType: file.type,
    })),
  );
  const request: ImportRequest = {
    ...fields,
    plan: date && slot ? { listId: fields.listId, date, slot } : undefined,
    source: contentSource(
      text,
      photos.map((p) => p.data),
    ),
  };
  const existing = await findCompletedImport(userId, request);
  if (existing) return existing;

  const measurements = await readImportMeasurements(pool, userId, request);
  const vocabulary = await readImportVocabulary(pool, userId, request);
  const shown = [
    photos.length
      ? "The photos show pages in order, such as cookbook pages, screenshots or handwritten cards. A recipe may run across several pages, and one page may hold several recipes or only part of one."
      : null,
    text
      ? `${photos.length ? "The cook added this note" : "The cook pasted this text, such as a recipe from a message, a social media caption or a whole recipe collection"}:\n${text}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  const result = await generateText({
    model: google("gemini-flash-lite-latest"),
    output: Output.object({
      schema: RecipesFoundSchema.or(z.object({ error: z.string() })),
    }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract every recipe the cook gave you, each into its own recipe fields. Skip pages that are no recipe, such as an introduction or a table of contents. ${shown}\n\n${extractionInstructions(request.locale, measurements, vocabulary)}\nFor from, give the book, author or account the content names, if any, and no url.\n\n${respondWithRecipes(request.locale)}`,
          },
          ...photos.flatMap((p, i) => [
            { type: "text" as const, text: `Photo ${i + 1}` },
            { type: "file" as const, ...p },
          ]),
        ],
      },
    ],
  });
  const found = extractedRecipes(
    result,
    photos.length
      ? "Could not read a recipe from those photos."
      : "Could not read a recipe from that text.",
  );
  return completeImport(
    userId,
    request,
    "save" in found
      ? {
          save: {
            ...found.save,
            from: importSource(undefined, found.save.from),
          },
        }
      : {
          review: {
            ...found.review,
            recipes: found.review.recipes.map((recipe) => ({
              ...recipe,
              from: importSource(undefined, recipe.from),
            })),
          },
        },
  );
}

function generateRecipe(content: string, { fetchUrl }: { fetchUrl: boolean }) {
  return generateText({
    model: google("gemini-flash-lite-latest"),
    output: Output.object({
      schema: RecipeSchema.or(z.object({ error: z.string() })),
    }),
    messages: [{ role: "user", content }],
    tools: fetchUrl
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { urlContext: (google.tools as any).urlContext({}) }
      : undefined,
  });
}

export function urlRetrievalStatus(
  result: Awaited<ReturnType<typeof generateRecipe>>,
): string | undefined {
  const metadata = result.finalStep.providerMetadata?.google
    ?.urlContextMetadata as
    { urlMetadata?: { urlRetrievalStatus?: string }[] } | null | undefined;
  return metadata?.urlMetadata?.[0]?.urlRetrievalStatus;
}

function modelError(output: unknown): string | undefined {
  return output && typeof output === "object" && "error" in output
    ? String(output.error)
    : undefined;
}
