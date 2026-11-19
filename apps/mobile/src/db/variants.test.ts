import { describe, expect, it, vi } from "vitest";

import type { Variant } from "./schema";
import { parseVariant, serializeVariant } from "./variants";

vi.mock("./system", () => ({ powersync: {} }));

const variant: Variant = {
  id: "variant",
  recipe_id: "recipe",
  list_id: "household",
  name: "Pasta",
  description: null,
  locale: "en",
  total_time: null,
  recipe_yield: "Anna and Jo, plus one extra helping",
  content_markdown: null,
  equipment: "[]",
  effort: null,
  ingredient_lines: "[]",
  instructions: "[]",
  sized_for: null,
  created_at: null,
  updated_at: null,
};

describe("placeholder prep notes", () => {
  it("reads a recipe whose prep a model left null or wrote as a word as unprepped", () => {
    const parsed = parseVariant({
      ...variant,
      ingredient_lines: JSON.stringify([
        {
          qty_text: "1",
          item_name: "onion",
          prep_note: null,
          swaps: [{ qty_text: null, item_name: "shallot", prep_note: "null" }],
        },
      ]),
      instructions: JSON.stringify([
        {
          name: "Chop",
          ingredients: [
            { qty_text: "1", item_name: "onion", prep_note: "null" },
          ],
          text: "Chop the onion.",
        },
      ]),
    });
    expect(parsed.ingredientLines[0]?.prep_note).toBeUndefined();
    expect(parsed.ingredientLines[0]?.swaps?.[0]?.prep_note).toBeUndefined();
    expect(parsed.instructions[0]?.ingredients).toEqual([
      { qty_text: "1", item_name: "onion", prep_note: undefined },
    ]);
  });
});

describe("variant sizing", () => {
  it("keeps the recorded target through mobile parsing and serialization without inventing old targets", () => {
    const sizing = {
      eater_ids: ["anna", "jo"],
      extra_portions: 1,
      total_target_kcal: 1950,
    };
    const parsed = parseVariant({
      ...variant,
      sized_for: JSON.stringify(sizing),
    });
    expect(parsed.sizedFor).toEqual(sizing);
    expect(JSON.parse(serializeVariant(parsed).sized_for!)).toEqual(sizing);

    const legacy = { eater_ids: ["anna"], extra_portions: 0 };
    expect(
      parseVariant({ ...variant, sized_for: JSON.stringify(legacy) }).sizedFor,
    ).toEqual(legacy);
    expect(parseVariant(variant).sizedFor).toBeNull();
  });
});
