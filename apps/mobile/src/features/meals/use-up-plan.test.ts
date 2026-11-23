import { expect, it } from "vitest";

import { projectUseUpPlan, type UseUpMealRow } from "./use-up-plan";

const target = { date: "2026-11-27", slot: "lunch" } as const;
const source = {
  slot_date: "2026-11-25",
  meal: "dinner",
  variant_id: "source-variant",
  ingredient_swaps: '{"1":1,"2":1}',
  ingredient_lines: JSON.stringify([
    {
      id: 1,
      item_name: "kale",
      qty_text: "200 g",
      swaps: [{ item_name: "cabbage", qty_text: "1 small head (400 g)" }],
    },
    {
      id: 2,
      item_name: "parsley",
      qty_text: "a few leaves",
      without: "Skip the garnish",
    },
  ]),
} satisfies UseUpMealRow;

it("uses the selected alternative quantity, drops skipped and written meals, and preserves repeat slots", () => {
  const repeated = { ...source, slot_date: target.date, meal: "treat" };
  const written = {
    ...source,
    slot_date: "2026-11-26",
    variant_id: null,
    ingredient_lines: null,
  };
  expect(projectUseUpPlan(target, [repeated, written, source])).toEqual({
    target,
    meals: [
      {
        date: source.slot_date,
        slot: "dinner",
        ingredients: [{ name: "cabbage", quantity: "1 small head (400 g)" }],
      },
      {
        date: repeated.slot_date,
        slot: "treat",
        ingredients: [{ name: "cabbage", quantity: "1 small head (400 g)" }],
      },
    ],
  });
});
