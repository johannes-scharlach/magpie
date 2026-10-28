import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractedRecipe,
  extractedRecipes,
  extractionInstructions,
  RecipesFoundSchema,
} from "./recipe-extraction.js";
import type { RecipeInput } from "./recipe-schema.js";

const fallback = "Could not read a recipe from those photos.";
const recipe = (name: string): RecipeInput => ({
  name,
  description: "Beans with miso butter.",
  locale: "en",
  totalTime: "10 minutes",
  recipeYield: "2 servings",
  recipeIngredient: [{ qty_text: "1 tin", item_name: "beans" }],
  recipeInstructions: [
    { name: "Heat", ingredients: [], text: "Heat the beans with miso butter." },
  ],
  recipeCuisine: "japanese",
  tags: ["beans"],
  equipment: ["hob"],
  effort: "easy",
});

test("the model's own reason reaches the cook, so they know what to fix", () => {
  assert.throws(
    () =>
      extractedRecipe(
        {
          finishReason: "stop",
          output: {
            error:
              "The amounts are cut off. Take a photo of the whole ingredient list.",
          },
        },
        fallback,
      ),
    {
      code: "RECIPE_EXTRACTION_FAILED",
      status: 422,
      message:
        "The amounts are cut off. Take a photo of the whole ingredient list.",
    },
  );
});

test("a refusal has no reason for the cook, so they get the general message", () => {
  assert.throws(
    () =>
      extractedRecipe(
        {
          finishReason: "content-filter",
          rawFinishReason: "RECITATION",
          output: undefined,
        },
        fallback,
      ),
    {
      code: "RECIPE_EXTRACTION_FAILED",
      message: fallback,
      cause: "Finish reason RECITATION",
    },
  );
});

test("import converts only when enabled and explicitly returns no source measurements", () => {
  for (const preferences of [
    undefined,
    {
      system: "metric",
      temperature: "fahrenheit",
      convert_imports: false,
    } as const,
  ]) {
    const instructions = extractionInstructions("en", preferences);
    assert.match(instructions, /Keep source amounts and temperatures exactly/);
    assert.doesNotMatch(instructions, /Convert measurements/);
  }

  const instructions = extractionInstructions("en", {
    system: "metric",
    temperature: "fahrenheit",
    convert_imports: true,
  });
  assert.match(instructions, /Convert measurements/);
  assert.match(instructions, /metric \(g, kg, ml, l\)/);
  assert.match(instructions, /Fahrenheit \(°F\)/);
  assert.match(instructions, /throughout ingredients, steps and notes/);
  assert.match(
    instructions,
    /Keep teaspoons and tablespoons for small amounts/,
  );
  assert.match(instructions, /sensible precision/);
  assert.match(instructions, /do not invent uncertain conversions/);
  assert.match(instructions, /Do not retain source measurements/);
  assert.match(
    instructions,
    /parentheses, notes, extra fields or a separate original variant/,
  );
  assert.doesNotMatch(
    instructions,
    /Keep source amounts and temperatures exactly/,
  );
});

test("one complete recipe saves at once; anything more waits for the cook to choose", () => {
  const read = (output: unknown) =>
    extractedRecipes({ finishReason: "stop", output }, fallback);

  assert.deepEqual(read({ recipes: [recipe("Miso beans")], skipped: [] }), {
    save: recipe("Miso beans"),
  });

  const halfAnother = {
    recipes: [recipe("Miso beans")],
    skipped: [{ name: "Aubergine pasta", reason: "The steps are cut off." }],
  };
  assert.deepEqual(read(halfAnother), { review: halfAnother });

  assert.throws(
    () =>
      read({
        recipes: [],
        skipped: [
          { name: "Aubergine pasta", reason: "The steps are cut off." },
        ],
      }),
    { code: "RECIPE_EXTRACTION_FAILED", message: "The steps are cut off." },
  );
});

test("a review keeps the source page or photo beside complete and incomplete recipes", () => {
  const found = {
    recipes: [{ ...recipe("Miso beans"), sourceReference: "Pages 36–37" }],
    skipped: [
      {
        name: "Aubergine pasta",
        reason: "The steps are cut off.",
        sourceReference: "Photo 3",
      },
    ],
  };
  const output = RecipesFoundSchema.parse(found);
  assert.deepEqual(
    extractedRecipes({ finishReason: "stop", output }, fallback),
    {
      review: found,
    },
  );
});

test("text without page markers needs no invented page reference", () => {
  const found = { ...recipe("Miso beans"), sourceReference: null };
  const output = RecipesFoundSchema.parse({ recipes: [found], skipped: [] });
  assert.deepEqual(
    extractedRecipes({ finishReason: "stop", output }, fallback),
    {
      save: found,
    },
  );
});
