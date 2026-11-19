import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local =
  url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

// Connection-private tables only. No household data is changed.
test(
  "saved variants record and retain their historical meal sizing stamp",
  { skip: !local },
  async (t) => {
    const { mealSizing } = await import("@magpie/meals");
    const { buildChatTools } = await import("./chat-tools.js");
    const { pool } = await import("./db.js");
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const userId = "a4600000-0000-4000-8000-000000000001";
      const listId = "b4600000-0000-4000-8000-000000000001";
      const anna = "a4600000-0000-4000-8000-000000000002";
      const jo = "a4600000-0000-4000-8000-000000000003";
      const outsider = "a4600000-0000-4000-8000-000000000004";
      await client.query(`
      CREATE TEMP TABLE list_members (list_id uuid, user_id uuid);
      CREATE TEMP TABLE household_people (id uuid PRIMARY KEY, list_id uuid, name text, portion_reference double precision);
      CREATE TEMP TABLE household_profiles (id uuid PRIMARY KEY, cuisines jsonb DEFAULT '[]', kitchen_equipment jsonb DEFAULT '{"other":[]}', day_habits jsonb DEFAULT '[]');
      CREATE TEMP TABLE recipes (
        id uuid PRIMARY KEY, list_id uuid, next_ingredient_id integer DEFAULT 1,
        cuisine text, tags jsonb DEFAULT '[]', from_name text, from_url text, created_by uuid, origin text
      );
      CREATE TEMP TABLE variants (
        id uuid PRIMARY KEY, recipe_id uuid, list_id uuid, name text, description text, locale text,
        total_time text, recipe_yield text, content_markdown text, equipment jsonb DEFAULT '[]', effort text,
        ingredient_lines jsonb, instructions jsonb, sized_for jsonb, created_at timestamptz DEFAULT now()
      );
      INSERT INTO list_members VALUES ('${listId}', '${userId}');
      INSERT INTO household_profiles (id) VALUES ('${listId}');
      INSERT INTO household_people VALUES
        ('${anna}', '${listId}', 'Anna', 1),
        ('${jo}', '${listId}', 'Jo', 1.25),
        ('${outsider}', 'b4600000-0000-4000-8000-000000000002', 'Another household', 2);
    `);
      t.mock.method(pool, "connect", async () =>
        Object.assign(client, { release: () => undefined }),
      );
      const tools = buildChatTools(userId, listId, {
        chatId: "chat",
        messageId: "message",
        today: "2026-10-30",
        chat: {
          list_id: listId,
          recipe_id: null,
          initial_variant_id: null,
          planned_meal_id: null,
        },
      });
      assert.equal("getMealSizing" in tools, false);
      const options = { toolCallId: "sizing", messages: [], context: {} };
      const sizedFor = mealSizing(
        { meal: "dinner", eater_ids: [anna, jo], extra_portions: 1 },
        [
          { id: anna, portion_reference: 1 },
          { id: jo, portion_reference: 1.25 },
        ],
      );
      assert.deepEqual(sizedFor, {
        eater_ids: [anna, jo],
        extra_portions: 1,
        total_target_kcal: 1950,
      });

      const recipe = {
        name: "Pasta",
        description: "Pasta with tomatoes.",
        locale: "en" as const,
        totalTime: "20 minutes",
        recipeYield: "Anna and Jo, plus one extra helping",
        recipeCuisine: "italian",
        tags: ["pasta"],
        equipment: ["stove"],
        effort: "easy" as const,
        recipeIngredient: [{ item_name: "Pasta", qty_text: "300g" }],
        recipeInstructions: [],
      };
      const save = tools.addToCookbook.execute!;
      const read = tools.readVariant.execute!;
      const rejected = await save(
        {
          ...recipe,
          sizedFor: { eater_ids: [outsider], extra_portions: 0 },
        },
        options,
      );
      assert.ok("error" in rejected);

      const saved = await save({ ...recipe, sizedFor }, options);
      assert.ok("variantId" in saved && saved.variantId);
      await client.query(
        "UPDATE household_people SET portion_reference = 1.5 WHERE id = $1",
        [jo],
      );
      const recorded = await read({ variantId: saved.variantId }, options);
      assert.ok("sizedFor" in recorded);
      assert.equal(recorded.sizedFor?.totalTargetKcal, 1950);

      const changed = await tools.updateRecipe.execute!(
        {
          variantId: saved.variantId,
          recipe: {
            ...recipe,
            recipeIngredient: recorded.recipeIngredient,
            description: "The same pasta, with clearer instructions.",
          },
        },
        options,
      );
      assert.ok("variantId" in changed);
      const changedRecipe = await read(
        { variantId: changed.variantId },
        options,
      );
      assert.ok("sizedFor" in changedRecipe);
      assert.equal(changedRecipe.sizedFor?.totalTargetKcal, 1950);

      const legacy = await save(
        { ...recipe, sizedFor: { eater_ids: [anna], extra_portions: 0 } },
        options,
      );
      assert.ok("variantId" in legacy && legacy.variantId);
      const legacyRecipe = await read({ variantId: legacy.variantId }, options);
      assert.ok("sizedFor" in legacyRecipe);
      assert.equal(legacyRecipe.sizedFor?.totalTargetKcal, undefined);
    } finally {
      await client.end();
    }
  },
);
