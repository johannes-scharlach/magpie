import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "pg";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const local =
  url && ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);

test(
  "imports read fresh measurements from the destination household, only for members",
  { skip: !local },
  async () => {
    const { readImportMeasurements } = await import("./import-and-plan.js");
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
      CREATE TEMP TABLE list_members (list_id uuid, user_id uuid, joined_at timestamptz);
      CREATE TEMP TABLE household_profiles (id uuid, measurements jsonb);
    `);
      const userId = "a3500000-0000-4000-8000-000000000001";
      const first = "b3500000-0000-4000-8000-000000000001";
      const second = "b3500000-0000-4000-8000-000000000002";
      const metric = {
        system: "metric",
        temperature: "fahrenheit",
        convert_imports: true,
      };
      const us = {
        system: "us",
        temperature: "celsius",
        convert_imports: false,
      };
      await client.query(
        "INSERT INTO list_members VALUES ($1, $3, '2026-01-01'), ($2, $3, '2026-02-01')",
        [first, second, userId],
      );
      await client.query(
        "INSERT INTO household_profiles VALUES ($1, $3), ($2, $4)",
        [first, second, JSON.stringify(metric), JSON.stringify(us)],
      );
      const request = {
        operationId: "c3500000-0000-4000-8000-000000000001",
        source: "https://example.com/recipe",
        locale: "en" as const,
        listId: second,
      };
      assert.deepEqual(
        await readImportMeasurements(client, userId, request),
        us,
      );
      assert.deepEqual(
        await readImportMeasurements(client, userId, {
          ...request,
          plan: { listId: first, date: "2026-10-27", slot: "dinner" },
        }),
        metric,
      );
      assert.deepEqual(
        await readImportMeasurements(client, userId, {
          ...request,
          listId: undefined,
        }),
        metric,
      );

      await client.query(
        "UPDATE household_profiles SET measurements = $1 WHERE id = $2",
        [JSON.stringify({ ...us, convert_imports: true }), second],
      );
      assert.equal(
        (await readImportMeasurements(client, userId, request)).convert_imports,
        true,
      );
      await assert.rejects(
        readImportMeasurements(
          client,
          "a3500000-0000-4000-8000-000000000002",
          request,
        ),
        { code: "LIST_ACCESS_DENIED" },
      );
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  },
);
