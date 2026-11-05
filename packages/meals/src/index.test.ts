import { describe, expect, it } from "vitest";

import {
  lineForItem,
  mealIngredients,
  mealSizing,
  mealSync,
  type IngredientLine,
} from "./index";

const lines: IngredientLine[] = [
  {
    id: 1,
    qty_text: "2 tins",
    item_name: "Sardines in olive oil",
    swaps: [
      { qty_text: "1 tin", item_name: "Canned tuna", prep_note: "drained" },
    ],
  },
  {
    qty_text: "200g",
    item_name: "Bulgur",
    swaps: [{ qty_text: "200g", item_name: "Couscous" }],
  },
  { qty_text: "1", item_name: "Lemon" },
  { qty_text: null, item_name: "Black pepper" },
];

describe("lineForItem", () => {
  it("does not guess when two lines could own the item", () => {
    const doubled = [...lines, lines[0]!];
    expect(lineForItem("Canned tuna", doubled)).toBeNull();
  });
});

describe("mealSync", () => {
  const meal = { eater_ids: ["anna", "ben"], extra_portions: 1.5 };
  const noSwaps = mealIngredients(lines, {});
  const oneSwap = mealIngredients(lines, { 1: 1 });

  it("is in sync only when sized for the same eaters, in any order, with no swaps pending", () => {
    expect(
      mealSync(
        { eater_ids: ["ben", "anna"], extra_portions: 1.5 },
        meal,
        noSwaps,
      ),
    ).toEqual({
      sizing: "match",
      swaps: 0,
      inSync: true,
    });
    expect(
      mealSync(
        { eater_ids: ["ben", "anna"], extra_portions: 1.5 },
        meal,
        oneSwap,
      ).inSync,
    ).toBe(false);
  });

  it("tells a recipe sized for other eaters from one never adjusted", () => {
    expect(
      mealSync({ eater_ids: ["anna"], extra_portions: 1.5 }, meal, noSwaps)
        .sizing,
    ).toBe("differs");
    expect(
      mealSync({ eater_ids: ["anna", "ben"], extra_portions: 0 }, meal, noSwaps)
        .sizing,
    ).toBe("differs");
    expect(mealSync(null, meal, noSwaps)).toEqual({
      sizing: "unknown",
      swaps: 0,
      inSync: false,
    });
  });

  it("offers adjustment when the same eaters now want a different recorded calorie target", () => {
    const recorded = { ...meal, total_target_kcal: 1950 };
    expect(
      mealSync(recorded, { ...meal, total_target_kcal: 2100 }, noSwaps),
    ).toEqual({
      sizing: "differs",
      swaps: 0,
      inSync: false,
    });
    expect(
      mealSync(recorded, { ...meal, total_target_kcal: 1950 }, noSwaps).inSync,
    ).toBe(true);
    // Missing historical targets stay unknown; current settings must not manufacture one.
    expect(
      mealSync(meal, { ...meal, total_target_kcal: 2100 }, noSwaps).inSync,
    ).toBe(true);
  });
});

describe("mealSizing", () => {
  it("resolves selected helpings and extra food into a lunch or dinner target", () => {
    const people = [
      { id: "anna", portion_reference: 1 },
      { id: "jo", portion_reference: 1.25 },
      { id: "not-eating", portion_reference: 2 },
    ];
    const meal = {
      meal: "dinner",
      eater_ids: ["anna", "jo"],
      extra_portions: 1,
    };
    const recorded = mealSizing(meal, people);
    expect(recorded).toEqual({
      eater_ids: ["anna", "jo"],
      extra_portions: 1,
      total_target_kcal: 1950,
    });
    expect(mealSizing({ ...meal, meal: "lunch" }, people)).toEqual(recorded);

    people[1]!.portion_reference = 1.5;
    expect(mealSizing(meal, people).total_target_kcal).toBe(2100);
    expect(recorded.total_target_kcal).toBe(1950);
    expect(mealSizing({ ...meal, meal: "treat" }, people)).toEqual({
      eater_ids: ["anna", "jo"],
      extra_portions: 1,
    });
  });
});
