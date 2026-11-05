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
