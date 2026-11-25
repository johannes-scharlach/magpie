import { expect, it } from "vitest";

import {
  addTypedIngredient,
  ingredientPickerSections,
  onHandIngredientChoices,
  togglePickedIngredient,
  type PickedIngredient,
} from "./ingredient-picker";

it("leaves unfilled grid slots empty and sorts the household list alphabetically", () => {
  const profile = {
    keeps: ["cream", "jasmine-rice", "noodles", "miso", "cabbage"],
    pantry: { other: [] },
    fresh_ingredients: { other: ["Chicken breast"] },
    extras: { japanese: ["Yuzu kosho"], fridge: ["Farmhouse curd"] },
  };
  const picker = onHandIngredientChoices({
    useUp: ["Dill", "Broccoli", "DILL"],
    profile,
    query: "",
    displayLabel: (label) => (label === "Broccoli" ? "Brokkoli" : label),
    locale: "de",
  });

  expect(picker.featured.map(({ label }) => label)).toEqual([
    "Dill",
    "Broccoli",
  ]);
  expect(picker.other.map(({ label }) => label)).toEqual([
    "Cabbage",
    "Chicken breast",
    "Cream",
    "Egg noodles",
    "Farmhouse curd",
    "Jasmine rice",
    "Miso",
    "Pasta",
    "Potatoes",
    "Rice",
    "Yuzu kosho",
  ]);
});

it("adds an unlisted ingredient once and keeps it available to deselect", () => {
  const picked = addTypedIngredient([], "  black garlic ");
  expect(ingredientPickerSections({ picked }).at(-1)).toEqual({
    id: "picked",
    tiles: [{ key: "black-garlic", label: "black garlic" }],
  });
  expect(addTypedIngredient(picked, "BLACK GARLIC")).toEqual(picked);
});

it("filters sections by a partial localized name without changing a picked ingredient", () => {
  const picked = [{ key: "cabbage", label: "Cabbage" }];
  const search = {
    query: "  REI ",
    displayLabel: (label: string) => (label === "Rice" ? "Reis" : label),
  };
  expect(ingredientPickerSections({ picked, ...search })).toEqual([
    { id: "staples", tiles: [{ key: "rice", label: "Rice" }] },
  ]);
  expect(
    ingredientPickerSections({ picked, query: "something crispy" }),
  ).toEqual([]);
  expect(ingredientPickerSections({ picked }).at(1)?.tiles).toEqual(picked);
});

it("keeps six ranked ingredients in the grid and preserves the order of overflow", () => {
  const options = {
    useUp: [
      "Dill",
      "Queso fresco",
      "Parsley",
      "Cilantro",
      "Provolone",
      " PROVOLONE ",
      "’Nduja",
      "Labneh",
      "Broccoli",
    ],
    profile: {
      keeps: ["provolone", "miso"],
      pantry: { other: [] },
      fresh_ingredients: { other: [] },
      extras: {},
    },
    displayLabel: (label: string) => label,
    locale: "en",
  };
  const picker = onHandIngredientChoices({ ...options, query: "" });
  expect(picker.featured.map(({ label }) => label)).toEqual([
    "Dill",
    "Queso fresco",
    "Parsley",
    "Cilantro",
    "Provolone",
    "’Nduja",
  ]);
  expect(picker.moreFromMealPlan.map(({ label }) => label)).toEqual([
    "Labneh",
    "Broccoli",
  ]);
  expect(picker.other.map(({ label }) => label)).toEqual([
    "Miso",
    "Pasta",
    "Potatoes",
    "Rice",
  ]);
  expect(
    onHandIngredientChoices({ ...options, query: "provol" }).other.map(
      ({ label }) => label,
    ),
  ).toEqual(["Provolone"]);
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

it("keeps the grid empty when Jev has no result and keeps the household list searchable", () => {
  const profile = {
    keeps: ["cream", "miso"],
    pantry: { other: ["Tahini"] },
    fresh_ingredients: { other: ["Chicken breast"] },
    extras: { japanese: ["Yuzu kosho"] },
  };
  const options = {
    profile,
    displayLabel: (label: string) => (label === "Cream" ? "Sahne" : label),
    locale: "de",
  };
  const picker = onHandIngredientChoices({ ...options, query: "" });
  expect(picker.featured).toEqual([]);
  expect(picker.other.map(({ label }) => label)).toContain("Yuzu kosho");
  const search = onHandIngredientChoices({ ...options, query: "sahn" });
  expect(search.featured).toEqual([]);
  expect(search.other.map(({ label }) => label)).toEqual(["Cream"]);
});

it("keeps the highest-priority translation without merging different forms or foods", () => {
  const sections = ingredientPickerSections({
    useUp: ["Berenjena", "Kohl", "Tomatenmark", "TK-Spinat"],
    profile: {
      keeps: ["canned-tomatoes", "frozen-spinach"],
      pantry: { other: [] },
      fresh_ingredients: { other: ["Eggplant", "Cabbage", "Kale", "Spinach"] },
      extras: {},
    },
  });
  expect(
    sections.map(({ id, tiles }) => [id, tiles.map(({ label }) => label)]),
  ).toEqual([
    ["useUp", ["Berenjena", "Kohl", "Tomatenmark", "TK-Spinat"]],
    ["staples", ["Rice", "Potatoes", "Pasta"]],
    ["cupboard", ["Kale", "Spinach", "Canned tomatoes"]],
  ]);
});
