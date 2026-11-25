import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

import {
  ingredientArtStore,
  listPendingIngredientArt,
  recordIngredientArt,
  reusePublishedIngredientArt,
} from "./ingredient-art-store.js";
import {
  reconsiderIngredientArt,
  resolveIngredientArt,
} from "./ingredient-art.js";

test("persisted misses resolve through a new store after publication and reconciliation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ingredient-art-db-"));
  let db = new PGlite(directory);
  try {
    // Minimal Supabase fixtures; the real migrations own all ingredient-art SQL.
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets (
        id text PRIMARY KEY, name text, public boolean,
        file_size_limit integer, allowed_mime_types text[]
      );
    `);
    for (const migration of [
      "20261123120000_ingredient_art_aliases.sql",
      "20261123130000_ingredient_art_assets.sql",
    ]) {
      await db.exec(
        await readFile(
          new URL(`../../../supabase/migrations/${migration}`, import.meta.url),
          "utf8",
        ),
      );
    }
    const labels = ["pointed cabbage", "spitzkohl"];
    const artId = `generated-${createHash("sha256").update(labels[0]!).digest("hex")}`;
    const neverJudge = async () =>
      assert.fail("Published aliases should not need a judgment");
    const judgeMisses = async () =>
      new Map(
        labels.map((label) => [
          label,
          { missing: true as const, confidence: 0.99 },
        ]),
      );
    assert.deepEqual(
      await resolveIngredientArt(labels, ingredientArtStore(db), judgeMisses),
      [null, null],
    );

    await recordIngredientArt(db, labels[0]!, artId);
    const pending = (await listPendingIngredientArt(db)).filter((name) =>
      labels.includes(name),
    );
    assert.deepEqual(pending, ["spitzkohl"]);
    const { aliases } = await reconsiderIngredientArt(
      pending,
      await ingredientArtStore(db).listPublished(),
      async () => new Map([["spitzkohl", { artId, confidence: 0.99 }]]),
    );
    await reusePublishedIngredientArt(db, aliases);

    await db.close();
    db = new PGlite(directory);
    assert.deepEqual(
      await resolveIngredientArt(labels, ingredientArtStore(db), neverJudge),
      [artId, artId],
    );
    assert.ok(
      !(await listPendingIngredientArt(db)).some((name) =>
        labels.includes(name),
      ),
    );
  } finally {
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
