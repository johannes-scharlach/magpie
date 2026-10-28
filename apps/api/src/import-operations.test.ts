import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { Client, type Pool } from "pg";

import type { ImportRequest } from "./import-request.js";
import type { RecipesFound } from "./recipe-extraction.js";
import type { RecipeInput } from "./recipe-schema.js";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local =
  url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

describe("import completion", { skip: !local }, () => {
  const schema = `import_test_${randomUUID().replaceAll("-", "")}`;
  let client: Client;
  let pool: Pool;
  let imports: typeof import("./import-and-plan.js");
  const databaseUrl = process.env.DATABASE_URL;

  // Private copies of the real tables, shared by the competing connections.
  // No triggers, household data, or push deliveries are involved.
  before(async () => {
    client = new Client({ connectionString: url });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    for (const table of [
      "import_operations",
      "list_members",
      "household_profiles",
      "household_people",
      "recipes",
      "variants",
      "planned_meals",
      "list_items",
    ]) {
      await client.query(
        `CREATE TABLE "${schema}".${table} (LIKE public.${table} INCLUDING ALL)`,
      );
    }
    await client.query(`SET search_path TO "${schema}"`);
    const connection = new URL(url!);
    connection.searchParams.set(
      "options",
      `-csearch_path=${schema} -cstatement_timeout=10000`,
    );
    connection.searchParams.set("application_name", schema);
    process.env.DATABASE_URL = connection.toString();
    ({ pool } = await import("./db.js"));
    imports = await import("./import-and-plan.js");
  });

  after(async () => {
    await pool?.end();
    if (databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = databaseUrl;
    if (client) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  });

  const recipe: RecipeInput = {
    name: "Miso beans",
    description: "Beans with miso butter.",
    locale: "en",
    totalTime: "10 minutes",
    recipeYield: "2 servings",
    recipeIngredient: [{ qty_text: "1 tin", item_name: "beans" }],
    recipeInstructions: [
      {
        name: "Heat",
        ingredients: [],
        text: "Heat the beans with miso butter.",
      },
    ],
    recipeCuisine: "japanese",
    tags: ["beans"],
    equipment: ["hob"],
    effort: "easy",
  };

  async function requestForUser() {
    const userId = randomUUID();
    const request: ImportRequest = {
      operationId: randomUUID(),
      listId: randomUUID(),
      source: "https://example.com/beans",
      locale: "en",
    };
    await client.query(
      "INSERT INTO list_members (list_id, user_id) VALUES ($1, $2)",
      [request.listId, userId],
    );
    return { userId, request };
  }

  async function assertSavedCount(
    request: ImportRequest,
    recipes: number,
    plannedMeals = 0,
  ) {
    const counts = await client.query(
      `SELECT
         (SELECT count(*)::int FROM recipes WHERE list_id = $1) AS recipes,
         (SELECT count(*)::int FROM variants WHERE list_id = $1) AS variants,
         (SELECT count(*)::int FROM planned_meals WHERE list_id = $1) AS planned_meals`,
      [request.listId],
    );
    assert.deepEqual(counts.rows[0], {
      recipes,
      variants: recipes,
      planned_meals: plannedMeals,
    });
  }

  async function storeReview(
    userId: string,
    request: ImportRequest,
    found: RecipesFound,
  ) {
    await client.query(
      `INSERT INTO import_operations (user_id, operation_id, outcome, review)
       VALUES ($1, $2, 'review', $3)`,
      [
        userId,
        request.operationId,
        JSON.stringify({ ...found, listId: request.listId }),
      ],
    );
  }

  test("a late single-recipe extraction preserves the existing review without saving or planning", async () => {
    const { userId, request } = await requestForUser();
    request.plan = {
      listId: request.listId!,
      date: "2026-10-28",
      slot: "dinner",
    };
    await storeReview(userId, request, {
      recipes: [{ ...recipe, sourceReference: "Page 37" }],
      skipped: [
        {
          name: "Aubergine pasta",
          sourceReference: "Page 38",
          reason: "The steps are cut off.",
        },
      ],
    });

    const result = await imports.completeImport(userId, request, {
      save: recipe,
    });

    assert.deepEqual(result, {
      review: {
        recipes: [{ name: "Miso beans", sourceReference: "Page 37" }],
        skipped: [
          {
            name: "Aubergine pasta",
            sourceReference: "Page 38",
            reason: "The steps are cut off.",
          },
        ],
      },
    });
    assert.deepEqual(
      await imports.findCompletedImport(userId, request),
      result,
    );
    await assertSavedCount(request, 0);
  });

  test("late extractions return the direct save even when their import inputs differ", async () => {
    const { userId, request } = await requestForUser();
    request.plan = {
      listId: request.listId!,
      date: "2026-10-28",
      slot: "dinner",
    };
    const saved = await imports.completeImport(userId, request, {
      save: recipe,
    });
    assert.ok("variantId" in saved);

    const lateRequest = { ...request, source: "https://example.com/pasta" };
    assert.deepEqual(
      await imports.completeImport(userId, lateRequest, {
        save: { ...recipe, name: "Aubergine pasta" },
      }),
      saved,
    );
    assert.deepEqual(
      await imports.completeImport(userId, lateRequest, {
        review: {
          recipes: [
            { ...recipe, name: "Aubergine pasta", sourceReference: null },
          ],
          skipped: [
            { name: "Soup", sourceReference: null, reason: "No steps." },
          ],
        },
      }),
      saved,
    );
    assert.deepEqual(
      await imports.findCompletedImport(userId, lateRequest),
      saved,
    );
    await assertSavedCount(request, 1, 1);
  });

  test("late extractions return the confirmed choices, not a different automatic Variant", async () => {
    const { userId, request } = await requestForUser();
    request.plan = {
      listId: request.listId!,
      date: "2026-10-28",
      slot: "dinner",
    };
    const review: RecipesFound = {
      recipes: [
        { ...recipe, sourceReference: "Page 37" },
        { ...recipe, name: "Aubergine pasta", sourceReference: "Page 38" },
      ],
      skipped: [],
    };
    await storeReview(userId, request, review);
    const saved = await imports.confirmImport(
      userId,
      request.operationId,
      [1, 0],
    );
    assert.equal(
      (
        await client.query("SELECT name FROM variants WHERE id = $1", [
          saved.variantId,
        ])
      ).rows[0].name,
      "Aubergine pasta",
    );

    assert.deepEqual(
      await imports.completeImport(userId, request, { save: recipe }),
      saved,
    );
    assert.deepEqual(
      await imports.completeImport(userId, request, { review }),
      saved,
    );
    assert.deepEqual(
      await imports.confirmImport(userId, request.operationId, [0]),
      saved,
    );
    assert.deepEqual(await imports.cancelImport(userId, request.operationId), {
      outcome: "saved",
      ...saved,
    });
    assert.deepEqual(await imports.findCompletedImport(userId, request), saved);
    await assertSavedCount(request, 2);
  });

  test("cancelled imports refuse automatic completion and confirmation without saving anything", async () => {
    const review: RecipesFound = {
      recipes: [{ ...recipe, sourceReference: "Page 37" }],
      skipped: [
        { name: "Pasta", sourceReference: "Page 38", reason: "No steps." },
      ],
    };
    for (const waitingForReview of [false, true]) {
      const { userId, request } = await requestForUser();
      if (waitingForReview) await storeReview(userId, request, review);
      assert.deepEqual(
        await imports.cancelImport(userId, request.operationId),
        { outcome: "cancelled" },
      );
      assert.deepEqual(
        await imports.cancelImport(userId, request.operationId),
        { outcome: "cancelled" },
      );
      await assert.rejects(
        imports.completeImport(userId, request, { save: recipe }),
        { code: "IMPORT_CANCELLED" },
      );
      await assert.rejects(
        imports.completeImport(userId, request, { review }),
        { code: "IMPORT_CANCELLED" },
      );
      await assert.rejects(
        imports.confirmImport(userId, request.operationId, [0]),
        { code: "IMPORT_CANCELLED" },
      );
      await assertSavedCount(request, 0);

      // Operation IDs belong to a user, not to everyone importing that source.
      const other = await requestForUser();
      other.request.operationId = request.operationId;
      const saved = await imports.completeImport(other.userId, other.request, {
        save: recipe,
      });
      assert.ok("variantId" in saved);
      await assertSavedCount(other.request, 1);
    }
  });

  test("competing completions wait on the operation lock and return the first committed result", async () => {
    const { userId, request } = await requestForUser();
    const attempts: Promise<unknown>[] = [];
    let released = false;
    await client.query("BEGIN");
    try {
      // The fixture connection pauses recipe writes, leaving two API connections
      // competing for this operation before either completion can commit.
      await client.query("LOCK recipes IN SHARE MODE");
      const gatePid: number = (
        await client.query("SELECT pg_backend_pid() AS pid")
      ).rows[0].pid;
      const first = imports.completeImport(userId, request, { save: recipe });
      attempts.push(first);
      const firstPid = await waitForBlockedConnection(gatePid, "relation");

      const second = imports.completeImport(
        userId,
        { ...request, source: "https://example.com/pasta" },
        { save: { ...recipe, name: "Aubergine pasta" } },
      );
      attempts.push(second);
      const secondPid = await waitForBlockedConnection(firstPid, "advisory");
      assert.notEqual(firstPid, secondPid);

      await client.query("COMMIT");
      released = true;
      const [saved, late] = await Promise.all([first, second]);
      assert.ok("variantId" in saved);
      assert.deepEqual(late, saved);
      await assertSavedCount(request, 1);
      assert.deepEqual(
        (
          await client.query("SELECT name FROM variants WHERE list_id = $1", [
            request.listId,
          ])
        ).rows,
        [{ name: "Miso beans" }],
      );
    } finally {
      if (!released) await client.query("ROLLBACK");
      await Promise.allSettled(attempts);
    }
  });

  async function waitForBlockedConnection(blockerPid: number, event: string) {
    const deadline = Date.now() + 5000;
    do {
      // The gate transaction would otherwise keep its first statistics snapshot.
      await client.query("SELECT pg_stat_clear_snapshot()");
      const waiting = await client.query<{ pid: number }>(
        `SELECT pid FROM pg_stat_activity
         WHERE application_name = $1 AND wait_event = $2
           AND $3 = ANY(pg_blocking_pids(pid))`,
        [schema, event, blockerPid],
      );
      if (waiting.rows[0]) return waiting.rows[0].pid;
      await setTimeout(10);
    } while (Date.now() < deadline);
    assert.fail(
      `No connection waited on the ${event} lock held by ${blockerPid}.`,
    );
  }
});
