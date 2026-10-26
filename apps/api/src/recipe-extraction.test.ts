import assert from "node:assert/strict";
import { test } from "node:test";

import { extractedRecipe } from "./recipe-extraction.js";

const fallback = "Could not read a recipe from those photos.";

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
