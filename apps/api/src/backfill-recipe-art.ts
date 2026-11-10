/**
 * Draws art for every recipe that has none (ADR 38): recipes from before
 * recipe art, and any whose drawing failed. One at a time, oldest first.
 *
 *   pnpm --filter api art:backfill
 *
 * Counts the recipes and asks before drawing; each one is a paid image call.
 * Uses DATABASE_URL, ART_MATTING_URL and SUPABASE_SERVICE_ROLE_KEY from
 * apps/api/.env unless the shell sets them, so check which database and
 * which storage they name.
 */
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { Client } from "pg";

import { env } from "./env.js";
import { artTools, drawRecipeArt } from "./recipe-art.js";

const tools = artTools();
if (!tools)
  throw new Error("Set ART_MATTING_URL and SUPABASE_SERVICE_ROLE_KEY first.");

const client = new Client({ connectionString: env.databaseUrl });
await client.connect();
try {
  const { rows } = await client.query<{ id: string }>(
    "SELECT id FROM recipes WHERE art_path IS NULL ORDER BY created_at, id",
  );
  const host = new URL(env.databaseUrl).host;
  const answer = await createInterface({ input: stdin, output: stdout })
    .question(
      `${rows.length} recipes without art in ${host}. Draw them? [y/N] `,
    )
    .finally(() => stdin.pause());
  if (answer.trim().toLowerCase() === "y") {
    let drawn = 0;
    let failed = 0;
    for (const [index, { id }] of rows.entries()) {
      try {
        const outcome = await drawRecipeArt(client, id, tools);
        if (outcome === "drawn") drawn++;
        console.log(`${index + 1}/${rows.length} ${id} ${outcome}`);
      } catch (error) {
        failed++;
        console.error(`${index + 1}/${rows.length} ${id} failed:`, error);
      }
    }
    console.log(`Drew ${drawn}, ${failed} failed, rest skipped.`);
  }
} finally {
  await client.end();
}
