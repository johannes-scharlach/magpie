import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local =
  url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

// Connection-private tables only; no changes to the household's real data.
test(
  "chat searches share matching, discover recipes before expanding variants, and stay in the household",
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
          ingredient_lines jsonb DEFAULT '[]', instructions jsonb DEFAULT '[]',
          recipe_yield text, sized_for jsonb, locale text, content_markdown text,
          created_at timestamptz DEFAULT '2026-10-01'
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
        UPDATE variants SET description = 'A weekday supper', equipment = '["air-fryer", "Sous-vide"]',
          effort = 'more-work', ingredient_lines = '[{"item_name":"lemongrass"}]',
          instructions = '[{"text":"Toast the cumin."}]'
          WHERE id = 'd3600000-0000-4000-8000-000000000001';
        INSERT INTO variants (id, recipe_id, list_id, name, created_at) VALUES
          ('d3600000-0000-4000-8000-000000000004', 'c3600000-0000-4000-8000-000000000001',
           'b3600000-0000-4000-8000-000000000001', 'Coconut vegetables on the stove', '2026-10-02');
      `);
      t.mock.method(pool, "connect", async () =>
        Object.assign(client, { release: () => undefined }),
      );

      const listId = "b3600000-0000-4000-8000-000000000001";
      const tools = buildChatTools("user", listId, {
        chatId: "chat",
        messageId: "message",
        today: "2026-10-28",
        chat: {
          list_id: listId,
          recipe_id: null,
          initial_variant_id: null,
          planned_meal_id: null,
        },
      });
      const savedExecute = tools.searchSavedRecipes.execute;
      const variantsExecute = tools.searchVariants.execute;
      assert.ok(savedExecute);
      assert.ok(variantsExecute);
      const options = { toolCallId: "search", messages: [], context: {} };
      const savedSearch = async (query: string) => {
        const result = await savedExecute({ query }, options);
        assert.ok("variants" in result);
        return result;
      };
      const variantSearch = async (
        query: string,
        recipeId?: string,
        limit = 10,
      ) => {
        const result = await variantsExecute(
          { query, recipeId, limit },
          options,
        );
        assert.ok("variants" in result);
        return result;
      };

      await t.test(
        "both tools match cookbook fields and readable names",
        async () => {
          for (const query of [
            "Thai",
            "curry",
            "North Indian",
            " AIR FRYER ",
            "Sous-vide",
            "More work",
            "weekday",
            "lemongrass",
            "Toast the cumin",
          ]) {
            const found = await variantSearch(query);
            assert.equal(found.variants.length, 1, query);
            assert.equal(found.hasMore, false);
            assert.deepEqual(await savedSearch(query), found);
          }
          const byCuisine = await savedSearch("Thai");
          assert.equal(
            byCuisine.variants[0]!.variantId,
            "d3600000-0000-4000-8000-000000000004",
          );
          assert.equal(byCuisine.variants[0]!.matchingVariantCount, 2);
          assert.equal(byCuisine.variants[0]!.cuisine, "Thai");
          const byEquipment = await savedSearch("Air fryer");
          assert.equal(
            byEquipment.variants[0]!.variantId,
            "d3600000-0000-4000-8000-000000000001",
          );
          assert.equal(byEquipment.variants[0]!.matchingVariantCount, 1);
          assert.equal(byEquipment.variants[0]!.variantCount, 2);
          assert.deepEqual(byEquipment.variants[0]!.matches, [
            { field: "equipment[0]", excerpt: "Air fryer" },
          ]);
        },
      );

      await t.test(
        "wildcards are literal and a recipe filter cannot cross households",
        async () => {
          for (const query of ["%", "\\"]) {
            assert.deepEqual(await savedSearch(query), {
              variants: [],
              hasMore: false,
            });
            assert.deepEqual(await variantSearch(query), {
              variants: [],
              hasMore: false,
            });
          }
          assert.deepEqual(
            await variantSearch("", "c3600000-0000-4000-8000-000000000003"),
            { variants: [], hasMore: false },
          );
        },
      );

      await client.query(`
        INSERT INTO recipes (id, tags)
          SELECT ('c3700000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, '[]'
          FROM generate_series(1, 11) AS n;
        INSERT INTO variants (id, recipe_id, list_id, name, created_at)
          SELECT ('d3700000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
            'c3700000-0000-4000-8000-000000000001', '${listId}',
            'Breadth ' || n, '2026-10-28'::timestamptz + n * interval '1 second'
          FROM generate_series(1, 50) AS n;
        INSERT INTO variants (id, recipe_id, list_id, name, created_at) VALUES
          ('d3700000-0000-4000-8000-000000000051', 'c3700000-0000-4000-8000-000000000001',
           '${listId}', 'An unrelated batch', '2026-10-30');
        INSERT INTO variants (id, recipe_id, list_id, name)
          SELECT ('d3800000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
            ('c3700000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
            '${listId}', 'Breadth recipe ' || n
          FROM generate_series(2, 11) AS n;
      `);

      await t.test(
        "50 matching variants cannot crowd other recipes out of discovery",
        async () => {
          const saved = await variantSearch("breadth");
          assert.equal(saved.variants.length, 10);
          assert.equal(
            new Set(saved.variants.map((variant) => variant.recipeId)).size,
            10,
          );
          assert.equal(saved.hasMore, true);
          assert.equal(
            saved.variants[0]!.variantId,
            "d3700000-0000-4000-8000-000000000050",
          );
          assert.equal(saved.variants[0]!.matchingVariantCount, 50);
          assert.equal(saved.variants[0]!.variantCount, 51);
          assert.ok(!JSON.stringify(saved).includes("Breadth 49"));
          assert.ok(!JSON.stringify(saved).includes("An unrelated batch"));
          assert.ok(
            saved.variants.every(
              (variant) =>
                !("ingredient_lines" in variant) &&
                !("instructions" in variant),
            ),
          );
          assert.deepEqual(await savedSearch("breadth"), saved);
          const all = await variantSearch("breadth", undefined, 11);
          assert.equal(all.variants.length, 11);
          assert.equal(all.hasMore, false);
          const one = await variantSearch("Thai", undefined, 1);
          assert.equal(one.variants[0]!.matchingVariantCount, 2);
          assert.equal(one.hasMore, false);
        },
      );

      await t.test(
        "a recipe filter expands matching variants and limits those instead",
        async () => {
          const recipeId = "c3700000-0000-4000-8000-000000000001";
          const scoped = await variantSearch("breadth", recipeId, 2);
          assert.deepEqual(
            scoped.variants.map((variant) => variant.variantId),
            [
              "d3700000-0000-4000-8000-000000000050",
              "d3700000-0000-4000-8000-000000000049",
            ],
          );
          assert.equal(scoped.hasMore, true);
          assert.equal(scoped.variants[0]!.matchingVariantCount, 50);
          const exact = await variantSearch("breadth 50", recipeId, 1);
          assert.equal(exact.variants.length, 1);
          assert.equal(exact.hasMore, false);
          const empty = await variantSearch("  ", recipeId, 2);
          assert.equal(
            empty.variants[0]!.variantId,
            "d3700000-0000-4000-8000-000000000051",
          );
          assert.equal(empty.variants[0]!.matchingVariantCount, 51);
        },
      );
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  },
);
