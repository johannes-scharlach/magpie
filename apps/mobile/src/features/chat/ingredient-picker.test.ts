import { expect, it } from "vitest";

import {
  ingredientPickerSections,
  togglePickedIngredient,
  type PickedIngredient,
} from "./ingredient-picker";

it("leads with four distinct use-up labels, then usual staples, then cupboard picks", () => {
  const sections = ingredientPickerSections({
    useUp: ["Cabbage", " potato ", "POTATOES", "Tofu", "Leeks", "Spinach"],
    profile: {
      keeps: ["basmati-rice", "tofu"],
      pantry: { other: [] },
      fresh_ingredients: { other: [] },
      extras: { cupboard: ["Miso"] },
    },
  });
  expect(
    sections.map(({ id, tiles }) => [id, tiles.map((tile) => tile.label)]),
  ).toEqual([
    ["useUp", ["Cabbage", "potato", "Tofu", "Leeks"]],
    ["staples", ["Basmati rice", "Rice", "Pasta"]],
    ["cupboard", ["Miso"]],
  ]);
});

it("keeps a picked tile editable after refresh without selecting its replacement", () => {
  const before = ingredientPickerSections({ useUp: ["Cabbage"] });
  let picked: readonly PickedIngredient[] = [];
  picked = togglePickedIngredient(picked, before[0]!.tiles[0]!);
  const after = ingredientPickerSections({ useUp: ["Leeks"], picked });
  expect(after[0]?.tiles.map((tile) => tile.label)).toEqual(["Leeks"]);
  expect(after.at(-1)).toEqual({ id: "picked", tiles: picked });
  expect(picked.map((tile) => tile.label)).toEqual(["Cabbage"]);
  expect(togglePickedIngredient(picked, after.at(-1)!.tiles[0]!)).toEqual([]);
});
