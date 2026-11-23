import { USE_UP_SLOTS } from "@magpie/meals";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import type { AppBindings } from "../auth.js";
import { rankUseUp } from "../use-up.js";

const Target = z.strictObject({
  date: z.iso.date(),
  slot: z.enum(USE_UP_SLOTS),
});
const Ingredient = z.strictObject({
  name: z.string().trim().min(1).max(200),
  quantity: z.string().trim().min(1).max(200).nullable(),
});
const Request = z.strictObject({
  target: Target,
  meals: z
    .array(Target.extend({ ingredients: z.array(Ingredient).max(48) }))
    .max(45)
    .refine(
      (meals) =>
        new Set(meals.map(({ date, slot }) => `${date}:${slot}`)).size ===
        meals.length,
    ),
});

export const useUp = new Hono<AppBindings>();

// The authenticated caller supplies its own local plan snapshot. No database
// reads or writes: an unsynced reservation must already affect this result.
useUp.post("/", bodyLimit({ maxSize: 64 * 1024 }), async (c) => {
  const parsed = Request.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HTTPException(400);
  try {
    const ingredients = await rankUseUp(parsed.data, {
      abortSignal: AbortSignal.any([
        c.req.raw.signal,
        AbortSignal.timeout(20_000),
      ]),
    });
    return c.json({ ingredients });
  } catch {
    // Provider errors can include plan contents. Do not log or return them.
    throw new HTTPException(503, {
      message: "Use-up suggestions are unavailable.",
    });
  }
});
