import { z } from "zod";

import { powersync } from "@/db/system";
import { env } from "@/lib/env";
import { posthogLogger } from "@/lib/posthog-logs";
import { supabase } from "@/lib/supabase";
import type { ImageAttachment } from "@/features/chat/image-attachment";
import { ImportFailure, importFailure } from "./import-failure";
import type { ImportRequest, ImportResult, ImportTarget } from "./import-jobs";

const ImportResultSchema = z.object({
  recipeId: z.uuid(),
  variantId: z.uuid(),
});
const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const permanentErrors = new Set([
  "MEAL_SLOT_OCCUPIED",
  "LIST_ACCESS_DENIED",
  "VARIANT_NOT_FOUND",
  "INVALID_REQUEST",
  "RECIPE_EXTRACTION_FAILED",
]);

type ImportRecipeRequest = Omit<ImportRequest, "plan"> &
  ({ plan: ImportTarget } | { listId: string });

/** Every attempt is logged, so retries show up as separate entries. */
export function importRecipe(
  request: ImportRecipeRequest,
): Promise<ImportResult> {
  return logged(
    {
      operation_id: request.operationId,
      source: "url",
      target: "plan" in request ? "plan" : "cookbook",
    },
    () =>
      requestImport("import-from-url", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      }),
  );
}

/** Pasted text, photos of one recipe in page order, or both, into the
 *  household's cookbook. */
export function importRecipeFromContent(request: {
  operationId: string;
  listId: string;
  text?: string;
  photos: ImageAttachment[];
}): Promise<ImportResult> {
  const body = new FormData();
  body.append("operationId", request.operationId);
  body.append("listId", request.listId);
  if (request.text) body.append("text", request.text);
  request.photos.forEach((photo, index) => {
    // React Native uploads a { uri, name, type } entry as a file.
    body.append("photos", {
      uri: photo.uri,
      name: `photo-${index + 1}.${photo.mediaType === "image/png" ? "png" : "jpg"}`,
      type: photo.mediaType,
    } as unknown as Blob);
  });
  return logged(
    {
      operation_id: request.operationId,
      source: request.photos.length ? "photos" : "text",
      target: "cookbook",
      photo_count: request.photos.length,
    },
    () => requestImport("import-from-content", { body }),
  );
}

async function logged(
  attributes: Record<string, string | number>,
  run: () => Promise<ImportResult>,
): Promise<ImportResult> {
  const startedAt = Date.now();
  const base = { operation: "recipe_import", ...attributes };
  try {
    const result = await run();
    posthogLogger.info("recipe import completed", {
      ...base,
      outcome: "success",
      duration_ms: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    const failure = importFailure(error);
    posthogLogger.warn("recipe import failed", {
      ...base,
      outcome: "failure",
      code: failure.code,
      message: failure.message,
      retryable: failure.retryable,
      duration_ms: Date.now() - startedAt,
    });
    throw error;
  }
}

async function requestImport(
  path: "import-from-url" | "import-from-content",
  init: { headers?: Record<string, string>; body: string | FormData },
): Promise<ImportResult> {
  const { data } = await supabase.auth.getSession();
  if (!data.session)
    throw new ImportFailure(
      "UNAUTHORIZED",
      "Sign in to import a recipe.",
      true,
    );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${env.apiUrl}/v1/recipes/${path}`, {
      signal: controller.signal,
      method: "POST",
      headers: {
        ...init.headers,
        authorization: `Bearer ${data.session.access_token}`,
      },
      body: init.body,
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const parsed = ApiErrorSchema.safeParse(body);
      if (parsed.success) {
        const { code, message } = parsed.data.error;
        throw new ImportFailure(code, message, !permanentErrors.has(code));
      }
      throw new ImportFailure(
        "INVALID_RESPONSE",
        "The server could not complete the import. Try again.",
        true,
      );
    }
    const parsed = ImportResultSchema.safeParse(body);
    if (!parsed.success)
      throw new ImportFailure(
        "INVALID_RESPONSE",
        "Could not read the import result. Try again.",
        true,
      );
    return parsed.data;
  } catch (error) {
    if (error instanceof ImportFailure) throw error;
    throw new ImportFailure(
      controller.signal.aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
      controller.signal.aborted
        ? "The request timed out. Retry to check whether it completed."
        : "Could not reach the server. Please try again.",
      true,
      { cause: error },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function waitForMeal(
  target: ImportTarget,
  result: ImportResult,
): Promise<void> {
  const deadline = Date.now() + 30000;
  for (;;) {
    const meal = await powersync.getOptional(
      `SELECT p.id FROM planned_meals p JOIN variants v ON v.id = p.variant_id
       WHERE p.list_id = ? AND p.slot_date = ? AND p.meal = ? AND p.variant_id = ?`,
      [target.listId, target.date, target.slot, result.variantId],
    );
    if (meal) return;
    if (Date.now() >= deadline) {
      throw new ImportFailure(
        "SYNC_TIMEOUT",
        "Saved, but not visible here yet. Retry to check again.",
        true,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}
