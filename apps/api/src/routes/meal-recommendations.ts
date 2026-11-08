import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppBindings } from "../auth.js";
import { pool, inTransaction } from "../db.js";
import { AppError } from "../errors.js";
import {
  loadRecommendationState,
  saveSeededMeal,
} from "../meal-recommendation-store.js";
import { recommendMeals } from "../meal-recommendations.js";
import { MEAL_SLOTS } from "../plan.js";

const RequestSchema = z.object({
  listId: z.uuid(),
  date: z.iso.date(),
  slot: z.enum(MEAL_SLOTS),
});
const SeedSchema = z.object({
  listId: z.uuid(),
  seedKey: z.string().min(1).max(500),
});

export const mealRecommendations = new Hono<AppBindings>();

mealRecommendations.post("/", async (c) => {
  const parsed = RequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    throw new AppError("INVALID_REQUEST", "Check the meal slot.", 400);
  if (!process.env.TYPESAFE_AI_API_KEY)
    throw new HTTPException(503, {
      message:
        "Suggestions are not configured yet. Browse your cookbook instead.",
    });
  const { listId, date, slot } = parsed.data;
  const client = await pool.connect();
  const state = await (async () => {
    try {
      return await loadRecommendationState(
        client,
        c.get("user").id,
        listId,
        date,
        slot,
      );
    } finally {
      client.release();
    }
  })();
  // Never hold a database connection during a model call.
  const recommendations = await recommendMeals(
    state,
    AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(30000)]),
  );
  return c.json({
    recommendations: recommendations.map(
      ({ id, recipeId, seedKey, name, totalTime }) => ({
        id,
        recipeId,
        seedKey,
        name,
        totalTime,
      }),
    ),
  });
});

mealRecommendations.post("/seed", async (c) => {
  const parsed = SeedSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    throw new AppError("INVALID_REQUEST", "Check the selected idea.", 400);
  const userId = c.get("user").id;
  const { listId, seedKey } = parsed.data;
  return c.json(
    await inTransaction(userId, (client) =>
      saveSeededMeal(client, userId, listId, seedKey),
    ),
  );
});
