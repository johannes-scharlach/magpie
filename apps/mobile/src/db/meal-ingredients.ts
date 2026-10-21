import {
  ingredientOptions,
  isWithout,
  parseMealSwaps,
  resolveMealItem,
  type IngredientOption,
  type MealItem,
} from "@magpie/meals";

import {
  shoppingReview,
  undecidedCount,
} from "@/features/meals/shopping-review";

import type { ListItem } from "./schema";
import { powersync } from "./system";
import { parseAtHome } from "./meal-shopping";
import { getVariant, parseIngredientLines } from "./variants";

export type MealItemContext = {
  ingredient_lines: string | null;
  ingredient_swaps: string | null;
};

/** A row whose meal now goes without it is left as saved: the write that
 * chose "without" removes it in the same transaction. */
export function resolveShoppingItem<I extends ListItem & MealItemContext>(
  item: I,
): I {
  if (item.status === "purchased" || item.ingredient_id == null) return item;
  return (
    resolveMealItem(
      item,
      parseIngredientLines(item.ingredient_lines),
      parseMealSwaps(item.ingredient_swaps),
    ) ?? item
  );
}

type Transaction = Parameters<
  Parameters<typeof powersync.writeTransaction>[0]
>[0];

type MealChoice = { mealId: string; variantId: string; ingredientId: number };

/** The same meal write, whether the user is cooking, reviewing or shopping. */
export async function writeMealSwap(
  tx: Transaction,
  opts: MealChoice & { name: string },
) {
  await writeMealChoice(
    tx,
    opts,
    (option) => !isWithout(option) && option.item_name === opts.name,
  );
}

export async function setMealSwap(opts: Parameters<typeof writeMealSwap>[1]) {
  await powersync.writeTransaction((tx) => writeMealSwap(tx, opts));
}

/** Cook the meal without this ingredient. */
export async function writeGoWithout(tx: Transaction, opts: MealChoice) {
  await writeMealChoice(tx, opts, isWithout);
}

export async function goWithout(opts: MealChoice) {
  await powersync.writeTransaction((tx) => writeGoWithout(tx, opts));
}

async function writeMealChoice(
  tx: Transaction,
  opts: MealChoice,
  matches: (option: IngredientOption) => boolean,
) {
  const meal = await tx.getOptional<{
    variant_id: string;
    ingredient_swaps: string | null;
    ingredients_at_home: string | null;
  }>(
    "SELECT variant_id, ingredient_swaps, ingredients_at_home FROM planned_meals WHERE id = ?",
    [opts.mealId],
  );
  if (!meal || meal.variant_id !== opts.variantId) {
    throw new Error("This meal has changed. Open it again.");
  }
  const variant = await getVariant(tx, meal.variant_id);
  const line = variant?.ingredientLines.find(
    (line) => line.id === opts.ingredientId,
  );
  const options = line ? ingredientOptions(line) : [];
  const index = options.findIndex(matches);
  if (!variant || index < 0)
    throw new Error("This ingredient has changed. Open it again.");
  const swaps = parseMealSwaps(meal.ingredient_swaps);
  if (index) swaps[opts.ingredientId] = index;
  else delete swaps[opts.ingredientId];
  // Going without leaves nothing to buy. A purchase stays a purchase.
  if (isWithout(options[index]!)) {
    await tx.execute(
      "DELETE FROM list_items WHERE planned_meal_id = ? AND ingredient_id = ? AND status <> 'purchased'",
      [opts.mealId, opts.ingredientId],
    );
  }
  // Going without settles an ingredient; choosing it again reopens it.
  const items = await tx.getAll<MealItem>(
    "SELECT name, spec, status, ingredient_id FROM list_items WHERE planned_meal_id = ?",
    [opts.mealId],
  );
  const review = shoppingReview(
    variant.ingredientLines,
    items,
    swaps,
    parseAtHome(meal.ingredients_at_home),
  );
  await tx.execute(
    "UPDATE planned_meals SET ingredient_swaps = ?, shopping_reviewed_variant_id = ?, updated_at = ? WHERE id = ?",
    [
      JSON.stringify(swaps),
      undecidedCount(review) ? null : opts.variantId,
      new Date().toISOString(),
      opts.mealId,
    ],
  );
}
