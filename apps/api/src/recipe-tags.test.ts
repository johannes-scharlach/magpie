import assert from "node:assert/strict";
import { test } from "node:test";

import { settleTags } from "./recipe-tags.js";

const vocabulary = {
  cuisines: ["Georgian"],
  tags: ["pasta", "Auflauf"],
  equipment: ["Sous-vide"],
};
const settle = (recipe: Partial<Parameters<typeof settleTags>[0]>) =>
  settleTags(
    { recipeCuisine: "", tags: [], equipment: [], ...recipe },
    vocabulary,
  );

test("a recipe's cuisine and tags use the household's words when they mean the same", () => {
  assert.equal(settle({ recipeCuisine: "Italian" }).cuisine, "italian");
  assert.equal(settle({ recipeCuisine: "georgian" }).cuisine, "Georgian");
  assert.equal(settle({ recipeCuisine: " Basque " }).cuisine, "Basque");
  assert.equal(settle({ recipeCuisine: "" }).cuisine, null);

  assert.deepEqual(
    settle({ tags: [" Pasta", "auflauf", "pasta", "", "Flammkuchen"] }).tags,
    ["pasta", "Auflauf", "Flammkuchen"],
  );
});

test("a variant's equipment uses the profile's equipment words", () => {
  assert.deepEqual(
    settle({
      equipment: ["Air fryer", "stove", "sous-vide", "Smoker", "Stove"],
    }).equipment,
    ["air-fryer", "stove", "Sous-vide", "Smoker"],
  );
});
