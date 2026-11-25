import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateImage } from "ai";
import { Client } from "pg";

import {
  fillIngredientArtSheet,
  type IngredientArtCell,
} from "./ingredient-art-batch.js";
import { jevIngredientArt } from "./ingredient-art-jev.js";
import { canonicalArtName, reconsiderIngredientArt } from "./ingredient-art.js";
import {
  prepareIngredientArtSheet,
  readIngredientArtSheet,
  sheetSide,
} from "./ingredient-art-sheet.js";
import {
  ingredientArtStore,
  listPendingIngredientArt,
  recordIngredientArt,
  reusePublishedIngredientArt,
} from "./ingredient-art-store.js";

const usage = `pnpm --filter api ingredient-art:backfill [--run | --approve cell:digest] [--size 1-4] [--plan path]

Without --run: count distinct unresolved ingredients, with no writes or image calls.
With --run: check generated-art reuse, draw at most one paid sheet, then stage usable cutouts.
With --approve: publish only the exact staged cutout you inspected. Repeat the flag for multiple cells.
Keep the same --plan to retry the same cells. Default grid: 2x2.
Default plan: apps/api/.logs/ingredient-art-sheet.json (local, ignored).`;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} before running this command.`);
  return value;
}

function reviewCode(target: string, slot: IngredientArtCell, webp: Uint8Array) {
  const digest = createHash("sha256")
    .update(JSON.stringify([target, slot.cell, slot.ingredient]))
    .update(webp)
    .digest("hex");
  return `${slot.cell}:${digest}`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      run: { type: "boolean" },
      approve: { type: "string", multiple: true, default: [] },
      size: { type: "string", default: "2" },
      plan: { type: "string", default: ".logs/ingredient-art-sheet.json" },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  const approvals = values.approve;
  if (approvals.some((code) => !/^(?:[0-9]|1[0-5]):[a-f0-9]{64}$/.test(code)))
    throw new Error("Expected --approve cell:digest from the preview output.");
  if (values.run && approvals.length)
    throw new Error("Draw and review must be separate runs.");
  const side = sheetSide.parse(Number(values.size));
  const databaseUrl = required("DATABASE_URL");
  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    if (values.run || approvals.length) {
      const { rows } = await db.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_lock(hashtext('magpie ingredient art backfill')) AS locked`,
      );
      if (!rows[0]?.locked)
        throw new Error("An ingredient art backfill is already running.");
    }
    const queued = await listPendingIngredientArt(db);
    const published = await ingredientArtStore(db).listPublished();
    if (values.run && queued.length && published.size)
      required("TYPESAFE_AI_API_KEY");
    const needs = await reconsiderIngredientArt(
      queued,
      published,
      values.run
        ? (...args) => jevIngredientArt(AbortSignal.timeout(20_000))(...args)
        : undefined,
    );
    if (values.run) await reusePublishedIngredientArt(db, needs.aliases);
    const { pending } = needs;
    console.log(
      `${pending.length} distinct ${values.run ? "drawable" : "queued"} ingredients after ${values.run ? "rechecking" : "known reuse"} (${new URL(databaseUrl).host}).`,
    );
    if (
      (!values.run && !approvals.length) ||
      (!pending.length && !approvals.length)
    )
      return;

    const supabaseUrl = required("SUPABASE_URL").replace(/\/+$/, "");
    const path = resolve(values.plan);
    const previewPath = (code: string) =>
      `${path}.${code.replace(":", "-")}.webp`;
    async function publish(ingredient: string, webp: Uint8Array) {
      const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
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
    }
    if (approvals.length) {
      const plan = await readIngredientArtSheet(path, supabaseUrl);
      const reviewed = new Set<string>();
      for (const code of approvals) {
        const slot = plan?.cells[Number(code.split(":")[0])];
        if (
          !slot ||
          !pending.includes(
            canonicalArtName(slot.ingredient) ?? slot.ingredient,
          ) ||
          reviewed.has(slot.ingredient)
        )
          throw new Error(
            `Approval ${code} does not name a pending cell on this sheet.`,
          );
        const webp = await readFile(previewPath(code));
        if (reviewCode(supabaseUrl, slot, webp) !== code)
          throw new Error(`Staged bytes do not match approval ${code}.`);
        await publish(slot.ingredient, webp);
        reviewed.add(slot.ingredient);
        console.log(`Published ${JSON.stringify(slot.ingredient)}.`);
      }
      console.log(
        `${reviewed.size} published; ${pending.length - reviewed.size} total still pending.`,
      );
      return;
    }
    const mattingUrl = required("ART_MATTING_URL").replace(/\/+$/, "");
    const google = createGoogleGenerativeAI({
      apiKey: required("GOOGLE_GENERATIVE_AI_API_KEY"),
    });
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
        async confirmSubject(slot, webp) {
          const code = reviewCode(supabaseUrl, slot, webp);
          const preview = previewPath(code);
          await writeFile(preview, webp, { mode: 0o600 });
          console.log(`Review ${JSON.stringify(slot.ingredient)}: ${preview}`);
          console.log(
            `If it depicts the exact ingredient, use --approve ${code}`,
          );
          return "review";
        },
        publish,
      },
    );
    const counts = { published: 0, review: 0, missing: 0, retry: 0 };
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
      `${counts.review} awaiting review, ${counts.missing} missing, ${counts.retry} failed; ${counts.missing + counts.retry} cells to retry, ${pending.length} drawable names still pending (${seconds}s).`,
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
