import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output, type UserContent } from "ai";
import { Hono } from "hono";
import { z } from "zod";

import type { AppBindings } from "../auth.js";
import { env } from "../env.js";
import { locales, RecipeSchema, type Locale } from "../recipe-schema.js";
import { MEAL_SLOTS } from "../plan.js";
import { findCompletedImport, saveImport } from "../import-and-plan.js";
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
  extractionInstructions,
  respond,
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

const MAX_TEXT = 50_000;
const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 10_000_000;

const FromContentSchema = z.object({
  operationId: z.uuid(),
  listId: z.uuid(),
  text: z.string().trim().max(MAX_TEXT).optional(),
  locale: z.enum(locales).optional().default("en"),
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

/** Pasted text, photos of one recipe in page order, or both. */
recipes.post("/import-from-content", async (c) => {
  const body = await c.req.parseBody({ all: true }).catch(() => null);
  const parsed = FromContentSchema.safeParse(body);
  const photos = [body?.photos ?? []].flat();
  if (
    !parsed.success ||
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
      `Paste a recipe or choose up to ${MAX_PHOTOS} photos of it.`,
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
        target: "cookbook",
        text_length: request.text?.length ?? 0,
        photo_count: files.length,
        photo_bytes: files.reduce((sum, p) => sum + p.size, 0),
      },
      () => importFromContent(c.get("user").id, request, files),
    ),
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

  const instructions = extractionInstructions(locale, request.context);
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
  return saveImport(userId, request, {
    ...recipe,
    from: importSource(url, recipe.from),
  });
}

async function importFromContent(
  userId: string,
  { text, ...fields }: z.infer<typeof FromContentSchema>,
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
    source: contentSource(
      text,
      photos.map((p) => p.data),
    ),
  };
  const existing = await findCompletedImport(userId, request);
  if (existing) return existing;

  const shown = [
    photos.length
      ? "The photos may show a cookbook page, a screenshot or a handwritten card; several photos are pages of one recipe in order."
      : null,
    text
      ? `${photos.length ? "The cook added this note" : "The cook pasted this text, such as a recipe from a message or a social media caption"}:\n${text}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  const result = await generateRecipe(
    [
      {
        type: "text",
        text: `Extract the recipe the cook gave you into the recipe fields. ${shown}\n\n${extractionInstructions(request.locale, undefined)}\nFor from, give the book, author or account the content names, if any, and no url.\n\n${respond(request.locale)}`,
      },
      ...photos.map((p) => ({ type: "file" as const, ...p })),
    ],
    { fetchUrl: false },
  );
  const recipe = extractedRecipe(
    result,
    photos.length
      ? "Could not read a recipe from those photos."
      : "Could not read a recipe from that text.",
  );
  return saveImport(userId, request, {
    ...recipe,
    from: importSource(undefined, recipe.from),
  });
}

function generateRecipe(
  content: string | UserContent,
  { fetchUrl }: { fetchUrl: boolean },
) {
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
