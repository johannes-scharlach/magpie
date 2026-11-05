import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "pg";

import { readTagVocabulary, settleTags } from "./recipe-tags.js";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local =
  url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

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

// Connection-private tables only; no changes to real data.
test(
  "a day habit's word is a tag before any recipe has it",
  { skip: !local },
  async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TEMP TABLE household_profiles (
          id uuid PRIMARY KEY, cuisines jsonb, kitchen_equipment jsonb, day_habits jsonb
        );
        CREATE TEMP TABLE recipes (id uuid, list_id uuid, cuisine text, tags jsonb);
        CREATE TEMP TABLE variants (list_id uuid, equipment jsonb);
        INSERT INTO household_profiles VALUES (
          'b3600000-0000-4000-8000-000000000001', '["Georgian"]', '{"other": []}',
          '[{"days": ["mon"], "meal": "dinner", "what": "pizza"},
            {"days": ["wed"], "meal": "dinner", "what": "italian"},
            {"days": ["fri"], "meal": "dinner", "what": "Georgian"},
            {"per_week": 2, "meal": "either", "what": ["pasta", "thai"]},
            {"days": ["fri"], "meal": "both", "what": ["no meat"]},
            {"days": ["tue"], "meal": "dinner"}]'
        );
      `);
      assert.deepEqual(
        await readTagVocabulary(client, "b3600000-0000-4000-8000-000000000001"),
        {
          cuisines: ["Georgian"],
          tags: ["no meat", "pasta", "pizza"],
          equipment: [],
        },
      );
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  },
);
