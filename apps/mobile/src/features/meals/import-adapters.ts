import { File } from "expo-file-system";
import { z } from "zod";

import { powersync } from "@/db/system";
import { env } from "@/lib/env";
import { posthogLogger } from "@/lib/posthog-logs";
import { supabase } from "@/lib/supabase";
import { ImportFailure, importFailure } from "./import-failure";
import type {
  CancelOutcome,
  ImportOutcome,
  ImportRequest,
  ImportResult,
} from "./import-jobs";

const ImportResultSchema = z.object({
  recipeId: z.uuid(),
  variantId: z.uuid(),
});
/** Its content arrives through sync (ADR 35). */
const ImportReviewSchema = z.object({ review: z.object({}) });
const CancelOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("cancelled") }),
  ImportResultSchema.extend({ outcome: z.literal("saved") }),
]);
const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const permanentErrors = new Set([
  "MEAL_SLOT_OCCUPIED",
  "LIST_ACCESS_DENIED",
  "VARIANT_NOT_FOUND",
  "INVALID_REQUEST",
  "RECIPE_EXTRACTION_FAILED",
  "IMPORT_CANCELLED",
]);

/** A link, pasted text, or photos of pages in order. Every attempt is
 *  logged, so retries show up as separate entries. */
export function sendImport(request: ImportRequest): Promise<ImportOutcome> {
  const { operationId, listId, plan, source } = request;
  const attributes = {
    operation: "recipe_import",
    operation_id: operationId,
    source: source.kind === "link" ? "url" : source.kind,
    target: plan ? "plan" : "cookbook",
    photo_count: source.kind === "photos" ? source.photos.length : 0,
  };
  return logged(attributes, async () => {
    if (source.kind === "link") {
      const body = await post("import-from-url", {
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operationId,
          url: source.url,
          listId,
          plan: plan && { listId, ...plan },
        }),
      });
      return importResult(body);
    }
    const form = new FormData();
    form.append("operationId", operationId);
    form.append("listId", listId);
    if (plan) {
      form.append("date", plan.date);
      form.append("slot", plan.slot);
    }
    const text =
      source.kind === "text" ? source.text : source.note.trim() || undefined;
    if (text) form.append("text", text);
    if (source.kind === "photos") {
      source.photos.forEach((photo) => {
        // Expo's global fetch rejects React Native's { uri, name, type }
        // parts; it sends a file part only from a Blob such as
        // expo-file-system's File.
        form.append("photos", new File(photo.uri));
      });
    }
    const body = await post("import-from-content", { body: form });
    return ImportReviewSchema.safeParse(body).success
      ? { review: true }
      : importResult(body);
  });
}

export async function confirmImport(
  operationId: string,
  keep: number[],
): Promise<ImportResult> {
  return importResult(
    await post(`imports/${operationId}/confirm`, {
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keep }),
    }),
  );
}

export async function cancelImport(
  operationId: string,
): Promise<CancelOutcome> {
  const parsed = CancelOutcomeSchema.safeParse(
    await post(`imports/${operationId}/cancel`, { body: "" }),
  );
  if (!parsed.success)
    throw new ImportFailure(
      "INVALID_RESPONSE",
      "Could not read whether the import was cancelled. Try again.",
      true,
    );
  return parsed.data;
}

/** Until the recipe, and its meal when planned, or the review is on this
 *  phone. */
export async function waitForSync(
  { operationId, listId, plan }: ImportRequest,
  result: ImportOutcome,
): Promise<void> {
  const deadline = Date.now() + 30000;
  for (;;) {
    const found =
      "review" in result
        ? await powersync.getOptional(
            "SELECT id FROM import_operations WHERE id = ?",
            [operationId],
          )
        : plan
          ? await powersync.getOptional(
              `SELECT p.id FROM planned_meals p JOIN variants v ON v.id = p.variant_id
           WHERE p.list_id = ? AND p.slot_date = ? AND p.meal = ? AND p.variant_id = ?`,
              [listId, plan.date, plan.slot, result.variantId],
            )
          : await powersync.getOptional(
              "SELECT id FROM variants WHERE id = ?",
              [result.variantId],
            );
    if (found) return;
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

function importResult(body: unknown): ImportResult {
  const parsed = ImportResultSchema.safeParse(body);
  if (!parsed.success)
    throw new ImportFailure(
      "INVALID_RESPONSE",
      "Could not read the import result. Try again.",
      true,
    );
  return parsed.data;
}

async function logged<T extends ImportOutcome>(
  attributes: Record<string, string | number>,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await run();
    posthogLogger.info("recipe import completed", {
      ...attributes,
      outcome: "review" in result ? "review" : "success",
      duration_ms: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    const failure = importFailure(error);
    posthogLogger.warn("recipe import failed", {
      ...attributes,
      outcome: "failure",
      code: failure.code,
      message: failure.message,
      // What actually went wrong, which the message for the cook may hide.
      cause:
        failure.cause instanceof Error
          ? `${failure.cause.name}: ${failure.cause.message}`
          : String(failure.cause ?? ""),
      retryable: failure.retryable,
      duration_ms: Date.now() - startedAt,
    });
    throw error;
  }
}

/** The response body of a successful call; an ImportFailure otherwise. */
async function post(
  path: string,
  init: { headers?: Record<string, string>; body: string | FormData },
): Promise<unknown> {
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
    let response: Response;
    try {
      response = await fetch(`${env.apiUrl}/v1/recipes/${path}`, {
        signal: controller.signal,
        method: "POST",
        headers: {
          ...init.headers,
          authorization: `Bearer ${data.session.access_token}`,
        },
        body: init.body,
      });
    } catch (error) {
      // fetch throws for a lost connection and for a request the app could
      // not build, so the reason goes into the message.
      throw new ImportFailure(
        controller.signal.aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
        controller.signal.aborted
          ? "The request timed out. Retry to check whether it completed."
          : `Could not send the import (${error instanceof Error ? error.message : String(error)}). Check your connection and try again.`,
        true,
        { cause: error },
      );
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (response.ok) return body;
    const parsed = ApiErrorSchema.safeParse(body);
    if (parsed.success) {
      const { code, message } = parsed.data.error;
      throw new ImportFailure(code, message, !permanentErrors.has(code));
    }
    throw new ImportFailure(
      "INVALID_RESPONSE",
      `The server could not complete the import (HTTP ${response.status}). Try again.`,
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}
