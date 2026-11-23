import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppBindings } from "../auth.js";
import { pool } from "../db.js";
import { jevIngredientArt } from "../ingredient-art-jev.js";
import { ingredientArtStore } from "../ingredient-art-store.js";
import { resolveIngredientArt } from "../ingredient-art.js";

const request = z.strictObject({
  labels: z.array(z.string().trim().min(1).max(96)).max(12),
});
const store = ingredientArtStore(pool);

export const ingredientArt = new Hono<AppBindings>();

ingredientArt.post("/", bodyLimit({ maxSize: 8192 }), async (c) => {
  const parsed = request.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HTTPException(400);
  const judge = jevIngredientArt(AbortSignal.timeout(12_000));
  const artIds = await resolveIngredientArt(
    parsed.data.labels,
    store,
    async (...args) => {
      try {
        return await judge(...args);
      } catch {
        // Provider errors can include request context. Never log ingredient labels.
        console.warn("Ingredient artwork matching unavailable");
        return new Map();
      }
    },
  );
  return c.json({ artIds });
});
