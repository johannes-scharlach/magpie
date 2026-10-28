import assert from "node:assert/strict";
import { test } from "node:test";
import { Client, type PoolClient } from "pg";

import { insertVariant, variantUrl } from "./variants.js";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local =
  url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

test("saved recipes link to the Magpie variant screen", () => {
  const id = "50e8d194-4818-5c8b-9f60-c5a4d6c120c8";
  assert.equal(variantUrl(id), `magpie://variant/${id}`);
});

// Connection-private tables only; no changes to real data.
test(
  "the first variant tags the recipe; a variant in another cuisine is a new recipe",
  { skip: !local },
  async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
      CREATE TEMP TABLE household_profiles (id uuid PRIMARY KEY, cuisines jsonb, kitchen_equipment jsonb);
      CREATE TEMP TABLE recipes (
        id uuid PRIMARY KEY, list_id uuid, next_ingredient_id int DEFAULT 1,
        cuisine text, tags jsonb NOT NULL DEFAULT '[]'
      );
      CREATE TEMP TABLE variants (
        id uuid PRIMARY KEY, recipe_id uuid, list_id uuid, name text, description text, locale text,
        total_time text, recipe_yield text, content_markdown text,
        equipment jsonb NOT NULL DEFAULT '[]', effort text, ingredient_lines jsonb, instructions jsonb,
        sized_for jsonb
      );
    `);
      const listId = "b3600000-0000-4000-8000-000000000001";
      const recipeId = "c3600000-0000-4000-8000-000000000001";
      await client.query(`
      INSERT INTO household_profiles VALUES
        ('${listId}', '["italian", "Georgian"]', '{"oven": true, "other": ["Sous-vide"]}');
      INSERT INTO recipes (id, list_id, cuisine, tags) VALUES
        ('c3600000-0000-4000-8000-000000000002', '${listId}', 'italian', '["Pasta"]'),
        ('${recipeId}', '${listId}', NULL, '[]');
    `);
      const recipe = {
        name: "Khachapuri",
        description: "Cheese bread with an egg.",
        locale: "en" as const,
        totalTime: "1 hour",
        recipeYield: "2 servings",
        recipeCuisine: "georgian",
        tags: ["flatbread"],
        equipment: ["Oven"],
        effort: "more-work" as "more-work" | "easy",
        recipeIngredient: [{ item_name: "Sulguni", qty_text: "200g" }],
        recipeInstructions: [],
      };
      const save = (variantId: string, changes: Partial<typeof recipe>) =>
        insertVariant(client as PoolClient, {
          recipeId,
          variantId,
          recipe: { ...recipe, ...changes },
        });

      await save("d3600000-0000-4000-8000-000000000001", {});
      await save("d3600000-0000-4000-8000-000000000002", {
        tags: ["pasta"],
        equipment: ["sous-vide"],
        effort: "easy",
      });
      await assert.rejects(
        save("d3600000-0000-4000-8000-000000000003", { recipeCuisine: "Thai" }),
        { code: "DIFFERENT_RECIPE" },
      );

      assert.deepEqual(
        (
          await client.query(
            "SELECT cuisine, tags FROM recipes WHERE id = $1",
            [recipeId],
          )
        ).rows,
        [{ cuisine: "Georgian", tags: ["flatbread"] }],
      );
      assert.deepEqual(
        (
          await client.query(
            "SELECT equipment, effort FROM variants ORDER BY id",
          )
        ).rows,
        [
          { equipment: ["oven"], effort: "more-work" },
          { equipment: ["Sous-vide"], effort: "easy" },
        ],
      );
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  },
);
