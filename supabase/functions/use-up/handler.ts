import { MEAL_SLOTS } from '@magpie/meals';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { rankUseUp } from './rank.ts';

const Target = z.strictObject({
  date: z.iso.date(),
  slot: z.enum(MEAL_SLOTS),
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

export const useUp = new Hono();

// The authenticated caller supplies its own local plan snapshot so that
// assessment can see edits that are still syncing.
useUp.post('*', bodyLimit({ maxSize: 64 * 1024 }), async (c) => {
  const traceId = c.req.header('x-use-up-trace-id');
  // The Supabase CLI injects the internal Kong URL for local functions.
  const trace = traceId && /^[0-9a-f-]{36}$/i.test(traceId) &&
      Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '') === 'http://kong:8000'
    ? (event: string, details: Record<string, unknown>) =>
      console.info('[use-up]', JSON.stringify({ traceId, event, ...details }))
    : undefined;
  const startedAt = Date.now();
  const parsed = Request.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    trace?.('invalid_request', {});
    throw new HTTPException(400);
  }
  const timeout = AbortSignal.timeout(20_000);
  try {
    const ranked = await rankUseUp(parsed.data, {
      abortSignal: AbortSignal.any([c.req.raw.signal, timeout]),
      trace,
    });
    // Installed clients only accept up to four names. New clients opt in.
    const ingredients = c.req.header('x-use-up-results') === 'all' ? ranked : ranked.slice(0, 4);
    trace?.('completed', { elapsedMs: Date.now() - startedAt, ingredients });
    return c.json({ ingredients });
  } catch (error) {
    // Keep provider bodies, messages, and headers out of logs and responses.
    trace?.('failed', {
      elapsedMs: Date.now() - startedAt,
      reason: timeout.aborted
        ? 'timeout'
        : c.req.raw.signal.aborted
        ? 'client_aborted'
        : 'assessment_error',
      errorType: error instanceof Error ? error.name : typeof error,
      providerStatus: error && typeof error === 'object' && 'statusCode' in error &&
          typeof error.statusCode === 'number'
        ? error.statusCode
        : undefined,
    });
    throw new HTTPException(503, {
      message: 'Use-up suggestions are unavailable.',
    });
  }
});
