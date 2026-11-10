import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "pg";

import { drawRecipeArt, type ArtTools } from "./recipe-art.js";

// Runs against the already-running local stack, inside a rolled-back transaction.
const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local =
  url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

const user = "a3800000-0000-4000-8000-000000000001";
const list = "b3800000-0000-4000-8000-000000000001";
const recipe = "c3800000-0000-4000-8000-000000000001";
const seeded = "c3800000-0000-4000-8000-000000000002";

function fakeTools() {
  const calls: { prompts: string[]; uploads: string[] } = {
    prompts: [],
    uploads: [],
  };
  const tools: ArtTools = {
    draw: async (prompt) => {
      calls.prompts.push(prompt);
      return new Uint8Array([1]);
    },
    matte: async () => new Uint8Array([2]),
    upload: async (path) => {
      calls.uploads.push(path);
    },
  };
  return { tools, calls };
}

test(
  "a recipe gets art of its first variant's dish once; seeded dishes keep their bundled art",
  { skip: !local },
  async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO auth.users (id) VALUES ('${user}');
        INSERT INTO lists (id, name, created_by) VALUES ('${list}', 'Home', '${user}');
        INSERT INTO recipes (id, list_id, created_by) VALUES ('${recipe}', '${list}', '${user}');
        INSERT INTO variants (id, recipe_id, list_id, name, description, created_at) VALUES
          (gen_random_uuid(), '${recipe}', '${list}', 'Lemon Ricotta Pasta Bake', 'Baked and bubbling.', now() - interval '1 day'),
          (gen_random_uuid(), '${recipe}', '${list}', 'Smaller Lemon Ricotta Bake', null, now());
      `);
      const { tools, calls } = fakeTools();

      assert.equal(await drawRecipeArt(client, recipe, tools), "drawn");
      assert.equal(await drawRecipeArt(client, recipe, tools), "skipped");

      assert.equal(calls.prompts.length, 1);
      assert.match(calls.prompts[0]!, /Lemon Ricotta Pasta Bake/);
      assert.match(calls.prompts[0]!, /Baked and bubbling\./);
      assert.deepEqual(calls.uploads, [`${recipe}.webp`]);
      const saved = await client.query(
        "SELECT art_path FROM recipes WHERE id = $1",
        [recipe],
      );
      assert.deepEqual(saved.rows, [{ art_path: `${recipe}.webp` }]);

      // A seeded dish already has bundled art.
      await client.query(`
        INSERT INTO recipes (id, list_id, created_by) VALUES ('${seeded}', '${list}', '${user}');
        INSERT INTO variants (id, recipe_id, list_id, name) VALUES
          (gen_random_uuid(), '${seeded}', '${list}', 'Schweinekotelett with Zwetschgen, mustard and buttered Spätzle');
      `);
      assert.equal(await drawRecipeArt(client, seeded, tools), "skipped");
      assert.equal(calls.prompts.length, 1);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  },
);
