import type { Client } from "pg";
import { measurementsSchema, type Measurements } from "@magpie/profile";

import { inTransaction, pool } from "./db.js";
import { setPlannedMeal } from "./plan.js";
import type { RecipeInput } from "./recipe-schema.js";
import type { RecipesFound } from "./recipe-extraction.js";
import {
  createRecipe,
  findVariantIdentity,
  insertVariant,
} from "./variants.js";
import { AppError, ListAccessError, VariantNotFoundError } from "./errors.js";
import type { ImportRequest } from "./import-request.js";
import { readTagVocabulary, type TagVocabulary } from "./recipe-tags.js";
import {
  deriveVariantIdForImport,
  deriveVariantIdForReview,
} from "./import-identity.js";
import {
  ImportCancelledError,
  lockOperation,
  outcomeOf,
  recordCancel,
  recordReview,
  recordSave,
} from "./import-operations.js";
import {
  assertListMember,
  assertListMemberUntilCommit,
} from "./list-authorization.js";

/** What the recipes wait with until the cook chooses. */
type Review = RecipesFound & { listId: string };
export type ReviewSummary = {
  review: Pick<RecipesFound, "skipped"> & {
    recipes: Pick<
      RecipesFound["recipes"][number],
      "name" | "sourceReference"
    >[];
  };
};

function summary({ recipes, skipped }: Review): ReviewSummary {
  return {
    review: {
      recipes: recipes.map(({ name, sourceReference }) => ({
        name,
        sourceReference,
      })),
      skipped,
    },
  };
}

/** A retry finds the saved recipe, or the recipes waiting for review. */
export async function findCompletedImport(
  userId: string,
  request: ImportRequest,
) {
  const client = await pool.connect();
  try {
    if (request.plan)
      await assertListMember(client, userId, request.plan.listId);
    const outcome = await outcomeOf(client, userId, request.operationId);
    if (outcome?.outcome === "cancelled") throw new ImportCancelledError();
    if (outcome?.outcome === "review") return summary(outcome.review as Review);
    return outcome?.outcome === "saved"
      ? await savedImport(client, outcome.variantId)
      : null;
  } finally {
    client.release();
  }
}

/** Use the destination's saved choices, not the caller's region or another household. */
export async function readImportMeasurements(
  client: Pick<Client, "query">,
  userId: string,
  request: ImportRequest,
): Promise<Measurements> {
  const listId =
    request.plan?.listId ??
    request.listId ??
    (await firstListOf(client, userId));
  const result = await client.query<{ measurements: unknown }>(
    `SELECT p.measurements FROM list_members m
     LEFT JOIN household_profiles p ON p.id = m.list_id
     WHERE m.list_id = $1 AND m.user_id = $2`,
    [listId, userId],
  );
  if (!result.rows[0]) throw new ListAccessError();
  return measurementsSchema.parse(result.rows[0].measurements ?? {});
}

/** The words the destination household already tags its recipes with. */
export async function readImportVocabulary(
  client: Pick<Client, "query">,
  userId: string,
  request: ImportRequest,
): Promise<TagVocabulary> {
  const listId =
    request.plan?.listId ??
    request.listId ??
    (await firstListOf(client, userId));
  return readTagVocabulary(client, listId);
}

/** Accept an extraction once. Automatic retries never change an earlier outcome. */
export async function completeImport(
  userId: string,
  request: ImportRequest,
  found: { save: RecipeInput } | { review: RecipesFound },
) {
  let reviewCreated = false;
  const completed = await inTransaction(userId, async (client) => {
    await lockOperation(client, userId, request.operationId);
    const outcome = await outcomeOf(client, userId, request.operationId);
    if (outcome?.outcome === "cancelled") throw new ImportCancelledError();
    if (outcome?.outcome === "saved")
      return savedImport(client, outcome.variantId);
    if (outcome?.outcome === "review") return summary(outcome.review as Review);

    const listId =
      request.plan?.listId ??
      request.listId ??
      (await firstListOf(client, userId));
    await assertListMemberUntilCommit(client, userId, listId);

    if ("review" in found) {
      const review: Review = { ...found.review, listId };
      await recordReview(client, userId, request.operationId, review);
      reviewCreated = true;
      return summary(review);
    }

    const recipe = found.save;
    const variantId = deriveVariantIdForImport(userId, request);
    const recipeId = await createRecipe(client, {
      userId,
      listId,
      origin: "import",
      from: recipe.from,
    });
    const saved = await insertVariant(client, { recipeId, variantId, recipe });
    if (request.plan) {
      const { listId, date, slot } = request.plan;
      await setPlannedMeal(client, {
        listId,
        slotDate: date,
        meal: slot,
        variantId,
        ifOccupied: "reject",
      });
    }
    await recordSave(client, userId, request.operationId, variantId);
    return saved;
  });

  if (reviewCreated) {
    // The review is committed and syncs even if its push cannot be queued.
    try {
      await pool.query("SELECT public.queue_import_review($1, $2)", [
        userId,
        request.operationId,
      ]);
    } catch (cause) {
      console.error("import review push failed", cause);
    }
  }
  return completed;
}

/** Saves the chosen recipes to the cookbook, and ends the review. Returns the
 *  first, which arrives through sync with the rest. */
export async function confirmImport(
  userId: string,
  operationId: string,
  keep: number[],
) {
  return inTransaction(userId, async (client) => {
    await lockOperation(client, userId, operationId);
    const outcome = await outcomeOf(client, userId, operationId);
    if (outcome?.outcome === "cancelled") throw new ImportCancelledError();
    if (outcome?.outcome === "saved")
      return savedImport(client, outcome.variantId);
    if (outcome?.outcome !== "review")
      throw new AppError("INVALID_REQUEST", "Unknown import.", 404);
    const { listId, recipes } = outcome.review as Review;
    if (!keep.every((index) => index in recipes))
      throw new AppError("INVALID_REQUEST", "Unknown recipe.", 400);
    await assertListMemberUntilCommit(client, userId, listId);

    const saved = [];
    for (const index of keep) {
      const recipe = recipes[index]!;
      const recipeId = await createRecipe(client, {
        userId,
        listId,
        origin: "import",
        from: recipe.from,
      });
      saved.push(
        await insertVariant(client, {
          recipeId,
          variantId: deriveVariantIdForReview(userId, operationId, index),
          recipe,
        }),
      );
    }
    await recordSave(client, userId, operationId, saved[0]!.variantId);
    return saved[0]!;
  });
}

/** Where an import from a build that sends no list lands (ADR 27). */
async function firstListOf(
  client: Pick<Client, "query">,
  userId: string,
): Promise<string> {
  const first = await client.query<{ list_id: string }>(
    "SELECT list_id FROM list_members WHERE user_id = $1 ORDER BY joined_at, list_id LIMIT 1",
    [userId],
  );
  if (!first.rows[0]) throw new ListAccessError();
  return first.rows[0].list_id;
}

/** A cancel that comes after the save reports the saved recipe. */
export async function cancelImport(userId: string, operationId: string) {
  return inTransaction(userId, async (client) => {
    await lockOperation(client, userId, operationId);
    const outcome = await outcomeOf(client, userId, operationId);
    if (outcome?.outcome === "saved")
      return {
        outcome: "saved" as const,
        ...(await savedImport(client, outcome.variantId)),
      };
    if (outcome?.outcome === "cancelled") return outcome;
    await recordCancel(client, userId, operationId);
    return { outcome: "cancelled" as const };
  });
}

/** A missing Variant does not make a finished operation incomplete again. */
async function savedImport(client: Client, variantId: string) {
  const saved = await findVariantIdentity(client, variantId);
  if (!saved) throw new VariantNotFoundError();
  return saved;
}
