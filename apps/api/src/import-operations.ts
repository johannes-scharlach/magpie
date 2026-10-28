import type { PoolClient } from "pg";

import { AppError } from "./errors.js";

export class ImportCancelledError extends AppError {
  constructor() {
    super("IMPORT_CANCELLED", "This import was cancelled.", 409);
  }
}

/** Lock before reading the outcome or accepting an extraction (ADRs 34, 35). */
export async function lockOperation(
  transaction: PoolClient,
  userId: string,
  operationId: string,
): Promise<void> {
  await transaction.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [`recipe-import:${userId}:${operationId}`],
  );
}

/** The caller holds the lock and has found no earlier outcome. */
export async function recordReview(
  transaction: PoolClient,
  userId: string,
  operationId: string,
  review: unknown,
): Promise<void> {
  await transaction.query(
    `INSERT INTO import_operations (user_id, operation_id, outcome, review)
     VALUES ($1, $2, 'review', $3)`,
    [userId, operationId, JSON.stringify(review)],
  );
}

/** The caller holds the lock and has decided to save or confirm a review. */
export async function recordSave(
  transaction: PoolClient,
  userId: string,
  operationId: string,
  variantId: string,
): Promise<void> {
  await transaction.query(
    `INSERT INTO import_operations (user_id, operation_id, outcome, variant_id)
     VALUES ($1, $2, 'saved', $3)
      ON CONFLICT (user_id, operation_id) DO UPDATE
        SET outcome = 'saved', variant_id = EXCLUDED.variant_id, review = NULL`,
    [userId, operationId, variantId],
  );
}

/** The caller holds the lock and has decided to cancel, discarding any review. */
export async function recordCancel(
  transaction: PoolClient,
  userId: string,
  operationId: string,
): Promise<void> {
  await transaction.query(
    `INSERT INTO import_operations (user_id, operation_id, outcome)
     VALUES ($1, $2, 'cancelled')
      ON CONFLICT (user_id, operation_id) DO UPDATE
        SET outcome = 'cancelled', variant_id = NULL, review = NULL`,
    [userId, operationId],
  );
}

type Outcome =
  | { outcome: "saved"; variantId: string }
  | { outcome: "cancelled" }
  | { outcome: "review"; review: unknown };

/** Lock first to rely on the answer. */
export async function outcomeOf(
  client: PoolClient,
  userId: string,
  operationId: string,
): Promise<Outcome | undefined> {
  const result = await client.query<{
    outcome: Outcome["outcome"];
    variant_id: string | null;
    review: unknown;
  }>(
    "SELECT outcome, variant_id, review FROM import_operations WHERE user_id = $1 AND operation_id = $2",
    [userId, operationId],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  if (row.outcome === "review")
    return { outcome: "review", review: row.review };
  if (row.outcome === "saved" && row.variant_id)
    return { outcome: "saved", variantId: row.variant_id };
  return { outcome: "cancelled" };
}
