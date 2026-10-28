import { createHash } from "node:crypto";

import { magpieUuidV5 } from "./magpie-uuid.js";
import type { ImportRequest } from "./import-request.js";

/**
 * Repeating the same import request produces the same variant ID, so a retry
 * can recognize an earlier successful save. Keep the input encoding stable.
 */
export function deriveVariantIdForImport(
  userId: string,
  request: ImportRequest,
): string {
  const { operationId, source, context, locale, plan } = request;
  return magpieUuidV5(
    JSON.stringify([
      "recipe-import",
      userId,
      operationId,
      source,
      context ?? null,
      locale,
      plan ? [plan.listId, plan.date, plan.slot] : null,
    ]),
  );
}

/** One per recipe found by an import that waited for review (ADR 35), so a
 *  repeated confirm cannot save a recipe twice. */
export function deriveVariantIdForReview(
  userId: string,
  operationId: string,
  index: number,
): string {
  return magpieUuidV5(
    JSON.stringify(["recipe-import-review", userId, operationId, index]),
  );
}

/** Stands in for the URL when the recipe comes from pasted text or photos.
 *  Photos count in their order. */
export function contentSource(
  text: string | undefined,
  photos: Uint8Array[],
): string {
  const hash = createHash("sha256");
  hash.update(
    createHash("sha256")
      .update(text ?? "")
      .digest(),
  );
  for (const photo of photos) {
    hash.update(createHash("sha256").update(photo).digest());
  }
  return `content:${hash.digest("hex")}`;
}
