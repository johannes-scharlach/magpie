import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateImage } from "ai";
import { Client } from "pg";

import { fillIngredientArtSheet } from "./ingredient-art-batch.js";
import {
  prepareIngredientArtSheet,
  sheetSide,
} from "./ingredient-art-sheet.js";
import {
  listPendingIngredientArt,
  recordIngredientArt,
} from "./ingredient-art-store.js";

const usage = `pnpm --filter api ingredient-art:backfill [--run] [--size 1-4] [--plan path]

Without --run: count distinct unresolved ingredients, with no writes or image calls.
With --run: draw at most one paid sheet, then matte and publish its usable cells.
Keep the same --plan to retry the same cells. Default grid: 2x2.
Default plan: apps/api/.logs/ingredient-art-sheet.json (local, ignored).`;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before running this command.`);
  return value;
}

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      run: { type: "boolean" },
      size: { type: "string", default: "2" },
      plan: { type: "string", default: ".logs/ingredient-art-sheet.json" },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  const side = sheetSide.parse(Number(values.size));
  const databaseUrl = required("DATABASE_URL");
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    if (values.run) {
      const { rows } = await db.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_lock(hashtext('magpie ingredient art backfill')) AS locked`,
      );
      if (!rows[0]?.locked)
        throw new Error("An ingredient art backfill is already running.");
    }
    const pending = await listPendingIngredientArt(db);
    console.log(
      `${pending.length} distinct unresolved ingredients after reuse (${new URL(databaseUrl).host}).`,
    );
    if (!values.run || !pending.length) return;

    const supabaseUrl = required("SUPABASE_URL").replace(/\/+$/, "");
    const mattingUrl = required("ART_MATTING_URL").replace(/\/+$/, "");
    const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
    const google = createGoogleGenerativeAI({
      apiKey: required("GOOGLE_GENERATIVE_AI_API_KEY"),
    });
    const path = resolve(values.plan);
    const plan = await prepareIngredientArtSheet(
      path,
      supabaseUrl,
      pending,
      side,
    );
    console.log(`${plan.side}×${plan.side} sheet: ${path}`);
    const started = performance.now();
    const result = await fillIngredientArtSheet(
      plan.cells,
      plan.side,
      new Set(pending),
      {
        async draw(prompt) {
          const { image } = await generateImage({
            model: google.image("gemini-3.1-flash-lite-image"),
            prompt,
            aspectRatio: "1:1",
            providerOptions: {
              google: {
                imageConfig: { imageSize: plan.side > 2 ? "2K" : "1K" },
              },
            },
            abortSignal: AbortSignal.timeout(120_000),
            maxRetries: 0,
          });
          return image.uint8Array;
        },
        async matte(crop) {
          const response = await fetch(`${mattingUrl}/matte`, {
            method: "POST",
            body: crop as BodyInit,
            signal: AbortSignal.timeout(300_000),
          });
          if (response.status === 422) {
            const details = await response.text();
            if (details.includes("Nothing left after matting")) return null;
          }
          if (!response.ok)
            throw new Error(`Matting returned HTTP ${response.status}`);
          return new Uint8Array(await response.arrayBuffer());
        },
        async publish(ingredient, webp) {
          const artId = `generated-${createHash("sha256").update(ingredient).digest("hex")}`;
          const response = await fetch(
            `${supabaseUrl}/storage/v1/object/ingredient-art/${artId}.webp`,
            {
              method: "POST",
              headers: {
                authorization: `Bearer ${serviceKey}`,
                apikey: serviceKey,
                "content-type": "image/webp",
                "x-upsert": "true",
              },
              body: webp as BodyInit,
              signal: AbortSignal.timeout(30_000),
            },
          );
          if (!response.ok)
            throw new Error(`Storage returned HTTP ${response.status}`);
          await recordIngredientArt(db, ingredient, artId);
        },
      },
    );
    const counts = { published: 0, missing: 0, retry: 0 };
    for (const cell of result) {
      counts[cell.outcome]++;
      const location = `row ${Math.floor(cell.cell / plan.side) + 1}, column ${(cell.cell % plan.side) + 1}`;
      const detail =
        cell.outcome === "retry"
          ? ` (${cell.stage}: ${cell.error instanceof Error ? cell.error.message : "unknown error"})`
          : "";
      console.log(
        `${location} ${JSON.stringify(cell.ingredient)}: ${cell.outcome}${detail}`,
      );
    }
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    console.log(
      `${counts.published} published, ${counts.missing} missing, ${counts.retry} failed; ${counts.missing + counts.retry} cells to retry, ${pending.length - counts.published} total still pending (${seconds}s).`,
    );
    if (counts.missing || counts.retry) process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
