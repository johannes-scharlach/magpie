import { describe, expect, it } from "vitest";

import { matchRecipeSearch, type RecipeSearchData } from "./index";

const match = (data: Partial<RecipeSearchData>, query: string) =>
  matchRecipeSearch(
    {
      name: null,
      description: null,
      cuisine: null,
      tags: [],
      equipment: [],
      effort: null,
      ingredient_lines: [],
      instructions: [],
      ...data,
    },
    query,
  );

const recipe = {
  name: "Crisp vegetables",
  description: "A weekday supper",
  cuisine: "north-indian",
  tags: ["curry"],
  equipment: ["air-fryer", "Sous-vide"],
  effort: "more-work",
  ingredient_lines: [{ item_name: "chickpeas", qty_text: "1 tin" }],
  instructions: [{ text: "Toast the cumin." }],
};

describe("recipe search", () => {
  it.each([
    ["crisp", "name"],
    ["weekday", "description"],
    [" NORTH INDIAN ", "cuisine"],
    ["curry", "tags[0]"],
    ["Air fryer", "equipment[0]"],
    ["sous-vide", "equipment[1]"],
    ["More work", "effort"],
    ["chickpeas", "ingredients[0]"],
    ["toast", "steps[0]"],
  ])("finds %s in %s", (query, field) => {
    expect(
      matchRecipeSearch(recipe, query)?.map((match) => match.field),
    ).toEqual([field]);
  });

  it("matches stored ids as well as readable labels, without duplicate matches", () => {
    expect(matchRecipeSearch(recipe, "north-indian")).toEqual([
      { field: "cuisine", text: "north-indian" },
    ]);
    expect(matchRecipeSearch(recipe, "air-fryer")).toEqual([
      { field: "equipment[0]", text: "air-fryer" },
    ]);
    expect(match({ cuisine: "thai" }, "Thai")).toEqual([
      { field: "cuisine", text: "Thai" },
    ]);
    expect(match({ cuisine: "Swabian" }, "swabian")).toEqual([
      { field: "cuisine", text: "Swabian" },
    ]);
  });

  it("treats wildcard characters literally, and distinguishes no match from an empty search", () => {
    expect(match({ name: "Crisp vegetables" }, "%")).toBeNull();
    expect(match({ name: "Crisp vegetables" }, "_")).toBeNull();
    expect(match({ name: "Crisp vegetables" }, "\\")).toBeNull();
    expect(match({ name: "100%_\\done" }, "%_\\")).toEqual([
      { field: "name", text: "100%_\\done" },
    ]);
    expect(match({}, "thai")).toBeNull();
    expect(match({}, "  ")).toEqual([]);
  });
});
