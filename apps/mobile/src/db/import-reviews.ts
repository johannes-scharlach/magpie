import { useQuery } from "@powersync/react";
import type { z } from "zod";

import { ImportReviewSchema } from "./schemas";

export type ImportReview = { operationId: string } & z.infer<
  typeof ImportReviewSchema
>;

/** Imports waiting for the cook to choose which recipes to keep (ADR 35),
 *  newest first. The API writes them; a row leaves once saved or cancelled. */
export function useImportReviews(): ImportReview[] {
  const { data } = useQuery<{ id: string; review: string | null }>(
    "SELECT id, review FROM import_operations ORDER BY created_at DESC",
  );
  return data.flatMap(({ id, review }) => {
    try {
      const parsed = ImportReviewSchema.safeParse(JSON.parse(review ?? ""));
      return parsed.success ? [{ operationId: id, ...parsed.data }] : [];
    } catch {
      return [];
    }
  });
}
