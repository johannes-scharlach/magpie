/**
 * Draws art for every recipe that has none (ADR 38): recipes from before
 * recipe art, and any whose drawing failed. One at a time, oldest first.
 *
 *   pnpm --filter api art:backfill        # local, env from apps/api/.env
 *   fly ssh console --pty --app magpie-api -C "node dist/backfill-recipe-art.cjs"
 *
 * Counts the recipes and asks before drawing; each one is a paid image call.
 * Safe to rerun: recipes that got art are skipped.
 */
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { Client } from "pg";

import { env } from "./env.js";
import { artTools, drawRecipeArt } from "./recipe-art.js";

// No top-level await: the image bundles this as CJS, like the server.
async function main() {
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
    if (answer.trim().toLowerCase() !== "y") return;
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
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
