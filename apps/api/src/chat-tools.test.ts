import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local =
  url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

// Connection-private tables only; no changes to the household's real data.
test(
  "chat cookbook search matches recipe tags and cuisine names within the household",
  { skip: !local },
  async (t) => {
    const { buildChatTools } = await import("./chat-tools.js");
    const { pool } = await import("./db.js");
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TEMP TABLE recipes (id uuid PRIMARY KEY, cuisine text, tags jsonb);
        CREATE TEMP TABLE variants (
          id uuid PRIMARY KEY, recipe_id uuid, list_id uuid, name text, description text,
          total_time text, equipment jsonb DEFAULT '[]', effort text,
          ingredient_lines jsonb DEFAULT '[]', created_at timestamptz DEFAULT now()
        );
        INSERT INTO recipes VALUES
          ('c3600000-0000-4000-8000-000000000001', 'thai', '["curry"]'),
          ('c3600000-0000-4000-8000-000000000002', 'north-indian', '["dal"]'),
          ('c3600000-0000-4000-8000-000000000003', 'thai', '["curry"]');
        INSERT INTO variants (id, recipe_id, list_id, name) VALUES
          ('d3600000-0000-4000-8000-000000000001', 'c3600000-0000-4000-8000-000000000001',
           'b3600000-0000-4000-8000-000000000001', 'Coconut vegetables'),
          ('d3600000-0000-4000-8000-000000000002', 'c3600000-0000-4000-8000-000000000002',
           'b3600000-0000-4000-8000-000000000001', 'Lentil pot'),
          ('d3600000-0000-4000-8000-000000000003', 'c3600000-0000-4000-8000-000000000003',
           'b3600000-0000-4000-8000-000000000002', 'Another household''s vegetables');
      `);
      t.mock.method(pool, "query", client.query.bind(client));

      const listId = "b3600000-0000-4000-8000-000000000001";
      const search = buildChatTools("user", listId, {
        chatId: "chat",
        messageId: "message",
        today: "2026-10-28",
        chat: {
          list_id: listId,
          recipe_id: null,
          initial_variant_id: null,
          planned_meal_id: null,
        },
      }).searchSavedRecipes.execute;
      assert.ok(search);
      const options = { toolCallId: "search", messages: [], context: {} };
      const byTag = await search({ query: "curry" }, options);
      assert.ok(Array.isArray(byTag));
      assert.deepEqual(
        byTag.map((recipe) => recipe.variantId),
        ["d3600000-0000-4000-8000-000000000001"],
      );
      assert.deepEqual(await search({ query: "Thai" }, options), byTag);
      const byCuisineName = await search({ query: "North Indian" }, options);
      assert.ok(Array.isArray(byCuisineName));
      assert.deepEqual(
        byCuisineName.map((recipe) => ({
          variantId: recipe.variantId,
          cuisine: recipe.cuisine,
        })),
        [
          {
            variantId: "d3600000-0000-4000-8000-000000000002",
            cuisine: "North Indian",
          },
        ],
      );
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  },
);
