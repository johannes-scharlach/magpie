import {
  compareUseUpSlots,
  isWithout,
  mealIngredients,
  parseMealSwaps,
  nearbyUseUpDates,
  MEAL_SLOTS,
  type UseUpRequest,
  type UseUpTarget,
} from "@magpie/meals";
import { z } from "zod";

import { IngredientLineSchema } from "@/db/schemas";

export type UseUpMealRow = {
  slot_date: string;
  meal: string;
  variant_id: string | null;
  ingredient_swaps: string | null;
  ingredient_lines: string | null;
};

const IngredientLines = z.array(IngredientLineSchema);

/** A missing variant is not the same as a meal with no quantity evidence. */
export function projectUseUpPlan(
  target: UseUpTarget,
  rows: readonly UseUpMealRow[],
): UseUpRequest | null {
  const { from, through } = nearbyUseUpDates(target.date);
  const meals: UseUpRequest["meals"] = [];
  try {
    for (const row of rows) {
      const slot = MEAL_SLOTS.find((slot) => slot === row.meal);
      const date = row.slot_date;
      if (!slot || date < from || date > through || !row.variant_id) continue;
      if (compareUseUpSlots({ date, slot }, target) === 0) continue;
      // Wait for the ingredient lines before assessing a partially synced plan.
      if (row.ingredient_lines == null) return null;
      const lines = IngredientLines.parse(JSON.parse(row.ingredient_lines));
      const ingredients = mealIngredients(
        lines,
        parseMealSwaps(row.ingredient_swaps),
      ).flatMap(({ chosen }) =>
        isWithout(chosen)
          ? []
          : [
              {
                name: chosen.item_name.trim(),
                quantity: chosen.qty_text?.trim() || null,
              },
            ],
      );
      if (ingredients.length) meals.push({ date, slot, ingredients });
    }
  } catch {
    return null;
  }
  return { target, meals: meals.sort(compareUseUpSlots) };
}
