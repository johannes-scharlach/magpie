import {
  ingredientSpec,
  isWithout,
  mealIngredients,
  mealSizing,
  type MealSwaps,
  type IngredientLine,
  type SizedFor,
} from "@magpie/meals";
import type { PoolClient } from "pg";
import {
  measurementContext,
  measurementsSchema,
  portionTargetKcal,
  type Measurements,
} from "@magpie/profile";

import { inTransaction, pool } from "./db.js";
import { PlannedMealNotFoundError, VariantNotFoundError } from "./errors.js";
import {
  assertListMember,
  assertListMemberUntilCommit,
} from "./list-authorization.js";
import type { CookRecipeInput } from "./recipe-schema.js";
import { findVariantIdentity, insertVariant } from "./variants.js";
import { repointMealVariant } from "./reconcile-meal-shopping.js";

/**
 * Adjusting a planned meal (ADR 13): a new variant under the same recipe,
 * sized for the meal's eaters and extra with its choices folded in.
 * Shopping links reconcile by ingredient id; purchases retain their snapshots.
 */

type MealRow = {
  id: string;
  list_id: string;
  recipe_id: string;
  variant_id: string;
  slot_date: string;
  meal: string;
  eater_ids: string[];
  extra_portions: number;
  ingredient_swaps: MealSwaps;
};
type VariantRow = {
  name: string;
  description: string | null;
  locale: string;
  total_time: string | null;
  recipe_yield: string | null;
  sized_for: SizedFor | null;
  content_markdown: string | null;
  cuisine: string | null;
  tags: string[];
  equipment: string[];
  effort: string | null;
  ingredient_lines: IngredientLine[];
  instructions: unknown[];
};
type Person = {
  id: string;
  name: string;
  age_group: string | null;
  diet: string | null;
  diet_other: string | null;
  portion_reference: number;
};

export type AdjustContext = {
  meal: MealRow;
  variant: VariantRow;
  eaters: Person[];
  measurements: Measurements;
};

export type AdjustResult = { recipeId: string; variantId: string };

/** Everything the rewrite needs, or the finished result if this operation already ran. */
export async function loadAdjustContext(
  userId: string,
  plannedMealId: string,
  variantId: string,
): Promise<{ existing: AdjustResult } | { context: AdjustContext }> {
  const client = await pool.connect();
  try {
    const meal = (
      await client.query<MealRow>(
        `SELECT id, list_id, recipe_id, variant_id, slot_date, meal, eater_ids, extra_portions, ingredient_swaps
         FROM planned_meals WHERE id = $1`,
        [plannedMealId],
      )
    ).rows[0];
    if (!meal) throw new PlannedMealNotFoundError();
    await assertListMember(client, userId, meal.list_id);

    const existing = await findVariantIdentity(client, variantId);
    if (existing) return { existing };

    const variant = (
      await client.query<VariantRow>(
        `SELECT name, description, locale, total_time, recipe_yield, sized_for, content_markdown,
                r.cuisine, r.tags, equipment, effort, ingredient_lines, instructions
         FROM variants JOIN recipes r ON r.id = variants.recipe_id WHERE variants.id = $1`,
        [meal.variant_id],
      )
    ).rows[0];
    if (!variant) throw new VariantNotFoundError();

    const people = (
      await client.query<Person>(
        "SELECT id, name, age_group, diet, diet_other, portion_reference FROM household_people WHERE list_id = $1 ORDER BY created_at, id",
        [meal.list_id],
      )
    ).rows;
    // People removed from the household since are not eating anymore.
    const eaters = people.filter((p) => meal.eater_ids.includes(p.id));
    const profile = await client.query<{ measurements: unknown }>(
      "SELECT measurements FROM household_profiles WHERE id = $1",
      [meal.list_id],
    );
    const measurements = measurementsSchema.parse(
      profile.rows[0]?.measurements ?? {},
    );
    return { context: { meal, variant, eaters, measurements } };
  } finally {
    client.release();
  }
}

const joinNames = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** The ask, in words. The schema descriptions carry the ingredient format. */
export function adjustPrompt({
  meal,
  variant,
  eaters,
  measurements,
}: AdjustContext): string {
  const sizing = mealSizing(meal, eaters);
  const choices = mealIngredients(
    variant.ingredient_lines,
    meal.ingredient_swaps,
  );
  const swaps = choices.flatMap(({ line, chosen, swap }) => {
    if (!swap || isWithout(chosen)) return [];
    const spec = ingredientSpec(chosen);
    return [
      `- Ingredient id ${line.id}: use "${chosen.item_name}"${spec ? ` (${spec})` : ""} instead of "${line.item_name}". Preserve id ${line.id}.`,
    ];
  });
  const withouts = choices.flatMap(({ line, chosen }) =>
    isWithout(chosen)
      ? [
          `- Ingredient id ${line.id}, "${line.item_name}" (the cook chose "${chosen.without}").`,
        ]
      : [],
  );
  const who = eaters.map((p) => {
    const diet = p.diet === "other" ? p.diet_other : p.diet;
    return `${p.name} (${[p.age_group ?? "adult", diet, `${p.portion_reference} portion reference`, sizing.total_target_kcal !== undefined ? `about ${portionTargetKcal(p.portion_reference)} kcal` : null].filter(Boolean).join(", ")})`;
  });
  const extraPortions =
    meal.extra_portions > 0
      ? `, plus ${meal.extra_portions} extra portions (one extra portion is one adult helping)`
      : "";
  const yieldFor = `Sized for ${joinNames(eaters.map((p) => p.name))}${meal.extra_portions > 0 ? ` + ${meal.extra_portions} extra` : ""}`;

  return [
    "You are adjusting a saved recipe to the meal it is planned for. Return the complete recipe in the same JSON shape.",
    measurementContext(measurements),
    "Preserve each continuing ingredient's id, including substitutions and quantity changes. Omit id only for genuinely new ingredients. Do not renumber ingredients when reordering or removing them.",
    "",
    `Keep the language (locale "${variant.locale}"), the voice, the structure and the order of steps, and every detail you are not told to change. Keep the dish name unless a swap replaces an ingredient the name mentions; then rename the dish to match. The name, description and instructions must agree with the ingredient lines you return: nothing may still name an ingredient that was swapped out. contentMarkdown is only for useful context not covered by the structured fields; do not put ingredients or steps there, and update contextual notes if a swap makes them inaccurate.`,
    `A swap may change how the food is cooked or how long it takes — often that is exactly why the cook picked it. Follow the consequence through: rewrite every step whose method, order or timing it affects, and set totalTime to the new wall-clock time from the first thing the cook does until the food is ready. Never keep the old time when the work changed. Say so in the description too, when a shortcut is what makes this version different.`,
    "",
    `Eating: ${who.length ? who.join("; ") : "the household"}${extraPortions}.`,
    `The recipe as written says it serves: "${variant.recipe_yield ?? "unknown"}". Scale every amount, including each step's ingredient amounts, for exactly these eaters and extra: ${eaters.reduce((sum, p) => sum + p.portion_reference, meal.extra_portions)} regular adult portions in total. The explicit portion references already describe appetite; do not reduce them again based on age.`,
    `Previous sizing target: ${variant.sized_for?.total_target_kcal !== undefined ? `about ${variant.sized_for.total_target_kcal} kcal in total, recorded when this variant was written` : "unknown; do not reconstruct it from today's household settings"}.`,
    ...(sizing.total_target_kcal !== undefined
      ? [
          `New sizing target: about ${sizing.total_target_kcal} kcal for the whole meal, including sides and extra food. This total already includes each person's helping multiplier and the extras; apply it once, not once per dish. These are approximate cooking targets, not verified nutrition or a weight-loss prescription.`,
          "When a previous target is recorded, use the change from that target to size the existing recipe. Preserve the dish and sensible ingredient proportions; do not hit a number by arbitrarily adding oil or removing vegetables. Without a previous target, use the recipe's stated yield and ingredient amounts to judge the adjustment; never invent a historical calorie target.",
        ]
      : []),
    `Write recipeYield as who it is sized for: "${yieldFor}".`,
    "",
    ...(swaps.length
      ? [
          "The meal uses these choices, whether bought or already at home. Make each the line's item_name exactly as named in the choice with its own qty_text and prep_note, list the original as one of that line's swaps, and rewrite any step name or step text that names the original:",
          ...swaps,
          "",
        ]
      : []),
    ...(withouts.length
      ? [
          "The meal goes without these ingredients. Remove each line, and rewrite the steps, amounts, name and description so the dish still works and nothing mentions it:",
          ...withouts,
          "",
        ]
      : []),
    "Current recipe:",
    JSON.stringify(
      {
        name: variant.name,
        description: variant.description,
        locale: variant.locale,
        totalTime: variant.total_time,
        recipeYield: variant.recipe_yield,
        sizedFor: variant.sized_for,
        contentMarkdown: variant.content_markdown,
        recipeIngredient: variant.ingredient_lines,
        recipeInstructions: variant.instructions,
        recipeCuisine: variant.cuisine,
        tags: variant.tags,
        equipment: variant.equipment,
        effort: variant.effort,
      },
      null,
      2,
    ),
  ].join("\n");
}

/** Insert the new version, incorporate choices and reconcile shopping atomically. */
export async function saveAdjusted(opts: {
  userId: string;
  plannedMealId: string;
  variantId: string;
  context: AdjustContext;
  recipe: CookRecipeInput;
}): Promise<AdjustResult> {
  const { userId, plannedMealId, variantId, context, recipe } = opts;
  const {
    list_id: listId,
    recipe_id: recipeId,
    variant_id: oldVariantId,
  } = context.meal;
  return inTransaction(userId, async (client: PoolClient) => {
    await assertListMemberUntilCommit(client, userId, listId);
    // Same lock as imports: a concurrent retry waits, then finds the result.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [variantId],
    );
    const existing = await findVariantIdentity(client, variantId);
    if (existing) return existing;

    // The stamp is the meal as loaded, the same input the prompt was built
    // from; the device compares it to the meal's current values.
    await insertVariant(client, {
      recipeId,
      variantId,
      // Swaps and portions never change the dish, so its cuisine stays.
      recipe: {
        ...recipe,
        recipeCuisine: context.variant.cuisine ?? recipe.recipeCuisine,
      },
      baseVariantId: oldVariantId,
      sizedFor: mealSizing(context.meal, context.eaters),
    });
    await repointMealVariant(client, {
      mealId: plannedMealId,
      variantId,
      expectedVariantId: oldVariantId,
      expectedSwaps: context.meal.ingredient_swaps,
    });
    return { recipeId, variantId };
  });
}
