import { expect, it } from "vitest";

import {
  addTypedIngredient,
  ingredientPickerSections,
  onHandPickerGroups,
  togglePickedIngredient,
  type PickedIngredient,
} from "./ingredient-picker";

it("preserves the use-up ranking and alphabetizes the other choices by displayed name", () => {
  const groups = onHandPickerGroups(
    [
      {
        id: "useUp",
        tiles: [
          { key: "pear", label: "Pear" },
          { key: "apple", label: "Apple" },
        ],
      },
      { id: "fresh", tiles: [{ key: "lemon", label: "Lemon" }] },
      { id: "staples", tiles: [{ key: "rice", label: "Rice" }] },
      {
        id: "cupboard",
        tiles: [
          { key: "tea", label: "Tea" },
          { key: "sugar", label: "Sugar" },
        ],
      },
    ],
    "",
    (label) =>
      new Map([
        ["Lemon", "Zitrone"],
        ["Rice", "Reis"],
      ]).get(label) ?? label,
    "de",
  );
  expect(
    groups.map(({ id, tiles }) => [id, tiles.map(({ label }) => label)]),
  ).toEqual([
    ["useUp", ["Pear", "Apple"]],
    ["quickPicks", ["Rice", "Lemon"]],
    ["cupboard", ["Sugar", "Tea"]],
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

it("offers fresh household picks before staple shortcuts in Meals", () => {
  const sections = ingredientPickerSections({
    freshFirst: true,
    useUp: ["Broccoli"],
    profile: {
      keeps: ["basmati-rice", "bacon"],
      pantry: { other: ["Miso"] },
      fresh_ingredients: {
        broccoli: true,
        other: ["Parsley", "Chicken breast"],
      },
      extras: {},
    },
  });
  expect(
    sections.slice(0, 2).map(({ tiles }) => tiles.map(({ label }) => label)),
  ).toEqual([["Broccoli"], ["Parsley", "Chicken breast", "Bacon"]]);
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
