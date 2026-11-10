/**
 * Clay art for a saved recipe (ADR 38): draw the dish on grey, cut it out in
 * apps/art-matting, upload to the public recipe-art bucket, then set
 * recipes.art_path. Never blocks or fails a save.
 */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateImage } from "ai";
import type { ClientBase } from "pg";

import { pool } from "./db.js";
import { env } from "./env.js";
import { mealFamily } from "./meal-recommendation-context.js";
import { posthogApiLogger } from "./posthog-logs.js";

export type ArtTools = {
  /** A drawing of one dish on a flat #808080 background. */
  draw: (prompt: string) => Promise<Uint8Array>;
  /** The dish cut out: a WebP of at most 512px. */
  matte: (image: Uint8Array) => Promise<Uint8Array>;
  upload: (path: string, webp: Uint8Array) => Promise<void>;
};

/** The seeded art's prompt (chat/art/README.md), for one dish. */
export function artPrompt(name: string, description: string | null): string {
  const dish = description ? `${name}. ${description}` : name;
  return `A single small claymation meal composition, centered, with 15% clear margin on every side, front three-quarter view. The dish: ${dish}
Bold simple silhouette, recognisable as a small thumbnail.

Handcrafted stop-motion claymation art style, soft matte modeling clay with rounded edges, pillowy volume, cute tactile feel. Non-reflective, unglazed matte surface with zero specular highlights or shine. Sauces, egg whites, and toppings are sculpted from solid opaque clay, no wet or oily sheen. Soft diffused ambient lighting with gentle shadows. Solid flat uniform neutral mid-grey background, exact colour #808080, plain and seamless, no ground plane, no cast shadows on the background. No blue tones in any subject. No text, words, labels, lettering, brand marks, flags, borders, checkmarks, sparkles, or mascot.`;
}

/** Draws art for a recipe that has none, from its first variant. */
export async function drawRecipeArt(
  db: Pick<ClientBase, "query">,
  recipeId: string,
  tools: ArtTools,
): Promise<"drawn" | "skipped"> {
  const recipe = (
    await db.query<{
      art_path: string | null;
      name: string | null;
      description: string | null;
    }>(
      `SELECT r.art_path, v.name, v.description FROM recipes r
         JOIN variants v ON v.recipe_id = r.id
       WHERE r.id = $1 ORDER BY v.created_at, v.id LIMIT 1`,
      [recipeId],
    )
  ).rows[0];
  if (!recipe?.name || recipe.art_path) return "skipped";
  // The app shows a seeded dish's bundled art, found by name.
  if (mealFamily(recipe.name, null)) return "skipped";

  const webp = await tools.matte(
    await tools.draw(artPrompt(recipe.name, recipe.description)),
  );
  const path = `${recipeId}.webp`;
  await tools.upload(path, webp);
  // Two drawings of one recipe can race; the first to finish keeps its art.
  await db.query(
    "UPDATE recipes SET art_path = $2 WHERE id = $1 AND art_path IS NULL",
    [recipeId, path],
  );
  return "drawn";
}

/** Null when this server has no matting service or storage key. */
export function artTools(): ArtTools | null {
  const mattingUrl = process.env.ART_MATTING_URL?.replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!mattingUrl || !serviceKey) return null;
  const google = createGoogleGenerativeAI({ apiKey: env.googleApiKey });
  return {
    draw: async (prompt) => {
      const { image } = await generateImage({
        model: google.image("gemini-3.1-flash-lite-image"),
        prompt,
        aspectRatio: "1:1",
        abortSignal: AbortSignal.timeout(60_000),
      });
      return image.uint8Array;
    },
    matte: async (image) => {
      // A throttled shared CPU takes over a minute per matte, and a matte
      // can wait for the one before it. Cold start is about 20 s.
      const response = await fetch(`${mattingUrl}/matte`, {
        method: "POST",
        body: image,
        signal: AbortSignal.timeout(300_000),
      });
      if (!response.ok)
        throw new Error(
          `Matting failed: ${response.status} ${await response.text()}`,
        );
      return new Uint8Array(await response.arrayBuffer());
    },
    upload: async (path, webp) => {
      const response = await fetch(
        `${env.supabaseUrl}/storage/v1/object/recipe-art/${path}`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            "content-type": "image/webp",
            "x-upsert": "true",
          },
          body: webp,
        },
      );
      if (!response.ok)
        throw new Error(
          `Art upload failed: ${response.status} ${await response.text()}`,
        );
    },
  };
}

/** Starts art for a newly saved recipe without waiting for it. */
export function requestRecipeArt(recipeId: string): void {
  const tools = artTools();
  if (!tools) return;
  drawRecipeArt(pool, recipeId, tools).catch((cause: unknown) => {
    // The recipe keeps its gradient; `pnpm --filter api art:backfill` retries.
    console.error("recipe art failed", recipeId, cause);
    const error = cause instanceof Error ? cause : new Error(String(cause));
    posthogApiLogger.error("recipe art failed", {
      recipe_id: recipeId,
      error_name: error.name,
      error_message: error.message,
      stack: error.stack ?? "",
    });
  });
}
