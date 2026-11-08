import { householdSchema } from "@magpie/profile";
import type { PoolClient } from "pg";

import {
  assertListMember,
  assertListMemberUntilCommit,
} from "./list-authorization.js";
import {
  recommendationCandidates,
  mealFamily,
  recommendationHousehold,
  seededCandidates,
  seededMeal,
} from "./meal-recommendation-context.js";
import type {
  MealCandidate,
  RecommendationState,
} from "./meal-recommendations.js";
import { magpieUuidV5 } from "./magpie-uuid.js";
import { insertVariant } from "./variants.js";

export async function loadRecommendationState(
  client: PoolClient,
  userId: string,
  listId: string,
  date: string,
  slot: string,
): Promise<RecommendationState> {
  await assertListMember(client, userId, listId);
  const profile = (
    await client.query("SELECT * FROM household_profiles WHERE id = $1", [
      listId,
    ])
  ).rows[0];
  const people = (
    await client.query(
      "SELECT * FROM household_people WHERE list_id = $1 ORDER BY created_at, id",
      [listId],
    )
  ).rows;
  const household = profile
    ? recommendationHousehold(householdSchema.parse({ profile, people }))
    : {};
  const cookbook = (
    await client.query<MealCandidate>(
      `
    SELECT v.id, r.id AS "recipeId", null::text AS "seedKey", v.name,
      coalesce(v.description, '') AS description, v.total_time AS "totalTime",
      r.cuisine, r.tags, v.equipment, v.effort,
      ARRAY(SELECT line->>'item_name' FROM jsonb_array_elements(coalesce(v.ingredient_lines, '[]')) line) AS ingredients
    FROM recipes r
    JOIN LATERAL (SELECT * FROM variants WHERE recipe_id = r.id ORDER BY created_at DESC, id LIMIT 1) v ON true
    WHERE EXISTS (SELECT 1 FROM list_members WHERE list_id = r.list_id AND user_id = $1)
    ORDER BY r.created_at DESC, r.id LIMIT 80
  `,
      [userId],
    )
  ).rows;
  const plannedMeals = (
    await client.query<
      RecommendationState["plannedMeals"][number] & { recipeId: string | null }
    >(
      `
     SELECT to_char(pm.slot_date::date, 'YYYY-MM-DD') AS date, pm.meal AS slot, v.recipe_id AS "recipeId",
      coalesce(pm.name, v.name, 'Unnamed meal') AS name,
      ARRAY(SELECT line->>'item_name' FROM jsonb_array_elements(coalesce(v.ingredient_lines, '[]')) line) AS ingredients
    FROM planned_meals pm LEFT JOIN variants v ON v.id = pm.variant_id
     WHERE pm.list_id = $1 AND pm.slot_date::date >= $2::date - 14
       AND NOT (pm.slot_date::date = $2::date AND pm.meal = $3)
    ORDER BY pm.slot_date DESC, pm.meal
  `,
      [listId, date, slot],
    )
  ).rows.map(({ recipeId, ...meal }) => ({
    ...meal,
    mealFamily: mealFamily(meal.name, recipeId),
  }));
  return {
    date,
    slot,
    household,
    plannedMeals,
    candidates: recommendationCandidates(
      cookbook.map((c) => ({
        ...c,
        mealFamily: mealFamily(c.name, c.recipeId),
      })),
      seededCandidates(),
    ),
  };
}

/** Called only on selection. Retries reuse the same saved seed; opening a slot writes nothing. */
export async function saveSeededMeal(
  client: PoolClient,
  userId: string,
  listId: string,
  key: string,
) {
  await assertListMemberUntilCommit(client, userId, listId);
  const recipe = seededMeal(key);
  const recipeId = magpieUuidV5(JSON.stringify(["seeded-recipe", listId, key]));
  const variantId = magpieUuidV5(
    JSON.stringify(["seeded-variant", listId, key]),
  );
  await client.query(
    "INSERT INTO recipes (id, list_id, created_by) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING",
    [recipeId, listId, userId],
  );
  // Serializes two selections of the same seed, including across devices.
  await client.query("SELECT id FROM recipes WHERE id = $1 FOR UPDATE", [
    recipeId,
  ]);
  const existing = await client.query("SELECT id FROM variants WHERE id = $1", [
    variantId,
  ]);
  if (!existing.rowCount)
    await insertVariant(client, { recipeId, variantId, recipe });
  return { recipeId, variantId };
}
