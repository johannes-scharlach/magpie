import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";

import { RecipeSchema } from "./recipe-schema.js";

const base = {
  name: "Onion soup",
  description: "Sweet onions, dark stock.",
  locale: "en" as const,
  totalTime: "40 minutes",
  recipeYield: "2 servings",
  recipeIngredient: [],
  recipeInstructions: [],
  recipeCuisine: "french",
  tags: ["soup"],
  equipment: [],
  effort: "easy" as const,
};

test("reads prep an agent left as null or wrote as a word as no prep", () => {
  const parsed = RecipeSchema.parse({
    ...base,
    recipeIngredient: [
      { qty_text: "1", item_name: "onion", prep_note: null },
      {
        qty_text: "1",
        item_name: "carrot",
        prep_note: "null",
        swaps: [{ qty_text: null, item_name: "parsnip", prep_note: null }],
      },
    ],
    recipeInstructions: [
      {
        name: "Chop",
        ingredients: [{ qty_text: "1", item_name: "onion", prep_note: null }],
        text: "Chop the onion.",
      },
    ],
  });
  assert.equal(parsed.recipeIngredient[0]?.prep_note, undefined);
  assert.equal(parsed.recipeIngredient[1]?.prep_note, undefined);
  assert.equal(parsed.recipeIngredient[1]?.swaps?.[0]?.prep_note, undefined);
  const step = parsed.recipeInstructions[0]?.ingredients[0];
  assert.equal(
    typeof step === "object" ? step.prep_note : undefined,
    undefined,
  );
});

test("offers an optional, nullable prep in the JSON schema the model is given", () => {
  // The AI SDK reads this with io: "input" before every structured call.
  const json = z.toJSONSchema(RecipeSchema, { io: "input" }) as unknown as {
    properties: {
      recipeIngredient: {
        items: {
          properties: Record<string, { type?: unknown }>;
          required?: string[];
        };
      };
    };
  };
  const line = json.properties.recipeIngredient.items;
  assert.deepEqual(line.properties.prep_note?.type, ["string", "null"]);
  assert.ok(!line.required?.includes("prep_note"));
});
