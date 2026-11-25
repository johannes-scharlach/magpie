import { nearbyUseUpDates, type UseUpRequest } from "@magpie/meals";
import { useQuery } from "@powersync/react";
import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { z } from "zod";

import { useAuth } from "@/db/provider";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

import type { MealTarget } from "./slots";
import { createUseUpCache, NO_USE_UP_INGREDIENTS } from "./use-up-cache";
import { logUseUp, traceUseUpLocally } from "./use-up-debug";
import { projectUseUpPlan, type UseUpMealRow } from "./use-up-plan";

const Response = z.object({
  ingredients: z.array(z.string().min(1).max(200)),
});

const cache = createUseUpCache(async (snapshot, signal) => {
  const { request, userId } = JSON.parse(snapshot) as {
    request: UseUpRequest;
    userId: string;
  };
  const traceId = traceUseUpLocally ? randomUUID() : undefined;
  const startedAt = Date.now();
  logUseUp("request_started", {
    traceId,
    target: request.target,
    mealCount: request.meals.length,
  });
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session || data.session.user.id !== userId || signal.aborted)
      throw new Error("No active session for this assessment");
    const response = await fetch(
      `${env.supabaseUrl.replace(/\/+$/, "")}/functions/v1/use-up`,
      {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${data.session.access_token}`,
          apikey: env.supabasePublishableKey,
          "x-use-up-results": "all",
          ...(traceId ? { "x-use-up-trace-id": traceId } : {}),
        },
        body: JSON.stringify(request),
      },
    );
    logUseUp("http_response", {
      traceId,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
    });
    if (!response.ok) throw new Error("Use-up assessment unavailable");
    const { ingredients } = Response.parse(await response.json());
    logUseUp("request_completed", {
      traceId,
      ingredientCount: ingredients.length,
      elapsedMs: Date.now() - startedAt,
    });
    return ingredients;
  } catch (error) {
    logUseUp("request_failed", {
      traceId,
      elapsedMs: Date.now() - startedAt,
      aborted: signal.aborted,
      errorType: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
});

/**
 * Only mount with a validated slot target, or pass null when the picker is
 * closed. The UI owns selection and must not reset its draft when these
 * suggestions change. Null means a usable assessment may still arrive.
 */
export function useRankedUseUp(
  listId: string | null | undefined,
  target: MealTarget | null,
): readonly string[] | null {
  const { session, epoch, syncReady } = useAuth();
  const userId = session?.user.id;
  const date = target?.date;
  const slot = target?.slot;
  const scope =
    syncReady && userId && listId && date && slot
      ? JSON.stringify([userId, epoch, listId, date, slot])
      : null;
  const window = date && scope ? nearbyUseUpDates(date) : null;
  const query = useQuery<UseUpMealRow>(
    `SELECT pm.slot_date, pm.meal, pm.variant_id, pm.ingredient_swaps, v.ingredient_lines
     FROM planned_meals pm LEFT JOIN variants v ON v.id = pm.variant_id
     WHERE pm.list_id = ? AND pm.slot_date BETWEEN ? AND ?`,
    [scope ? listId : null, window?.from ?? null, window?.through ?? null],
    { reportFetching: true },
  );
  const plan = useMemo(
    () =>
      scope && date && slot
        ? projectUseUpPlan({ date, slot }, query.data)
        : null,
    [scope, date, slot, query.data],
  );
  const settled = !query.isLoading && !query.isFetching;
  const snapshot = useMemo(() => {
    if (!plan || !userId || query.error) return null;
    if (
      !plan.meals.some((meal) =>
        meal.ingredients.some(({ name, quantity }) => name && quantity),
      )
    )
      return null;
    return JSON.stringify({ request: plan, userId });
  }, [plan, userId, query.error]);
  const skipReason = query.error
    ? "local_query_failed"
    : !plan
      ? "plan_unavailable"
      : "no_quantified_candidates";
  const readAssessment = useCallback(
    () => (scope && snapshot ? cache.read(scope, snapshot) : null),
    [scope, snapshot],
  );
  const entry = useSyncExternalStore(cache.subscribe, readAssessment);

  useEffect(() => {
    if (!scope || !settled) return;
    if (!snapshot) {
      logUseUp("request_skipped", {
        date,
        slot,
        reason: skipReason,
      });
      cache.clear(scope);
      return;
    }
    if (entry) {
      const timeout = setTimeout(
        () => cache.expire(scope),
        Math.max(0, entry.expiresAt - Date.now()),
      );
      return () => clearTimeout(timeout);
    }
    void cache.refresh(scope, snapshot);
  }, [scope, settled, snapshot, entry, date, slot, skipReason]);

  useEffect(() => {
    if (!scope) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") cache.expire(scope);
    });
    return () => subscription.remove();
  }, [scope]);

  if (entry) return entry.ingredients;
  if (scope && !query.error && (query.isLoading || snapshot)) return null;
  return NO_USE_UP_INGREDIENTS;
}
