import {
  compareUseUpSlots,
  nearbyUseUpDates,
  type UseUpRequest,
} from "@magpie/meals";
import { useQuery } from "@powersync/react";
import { useEffect, useMemo, useReducer } from "react";
import { AppState } from "react-native";
import { z } from "zod";

import { useAuth } from "@/db/provider";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

import type { MealTarget } from "./slots";
import { createUseUpCache, NO_USE_UP_INGREDIENTS } from "./use-up-cache";
import { projectUseUpPlan, type UseUpMealRow } from "./use-up-plan";

const Response = z.object({
  ingredients: z.array(z.string().min(1).max(200)).max(4),
});

const cache = createUseUpCache(async (snapshot, signal) => {
  const { request, userId } = JSON.parse(snapshot) as {
    request: UseUpRequest;
    userId: string;
  };
  const { data } = await supabase.auth.getSession();
  if (!data.session || data.session.user.id !== userId || signal.aborted)
    throw new Error("No active session for this assessment");
  const response = await fetch(`${env.apiUrl}/v1/use-up`, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error("Use-up assessment unavailable");
  return Response.parse(await response.json()).ingredients;
});

/**
 * Only mount with a validated slot target, or pass null when the picker is
 * closed. The UI owns selection and must not reset its draft when these
 * suggestions change.
 */
export function useRankedUseUp(
  listId: string | null | undefined,
  target: MealTarget | null,
): readonly string[] {
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
      !plan.meals.some(
        (meal) =>
          compareUseUpSlots(meal, plan.target) < 0 &&
          meal.ingredients.some(({ name, quantity }) => name && quantity),
      )
    )
      return null;
    return JSON.stringify({ request: plan, userId });
  }, [plan, userId, query.error]);
  const entry =
    settled && scope && snapshot ? cache.read(scope, snapshot) : null;
  const [, rerender] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    if (!scope || !settled) return;
    if (!snapshot) {
      cache.clear(scope);
      return;
    }
    if (entry) {
      const timeout = setTimeout(
        rerender,
        Math.max(0, entry.expiresAt - Date.now()),
      );
      return () => clearTimeout(timeout);
    }
    let active = true;
    void cache.refresh(scope, snapshot).then(() => {
      if (active) rerender();
    });
    return () => {
      active = false;
    };
  }, [scope, settled, snapshot, entry]);

  useEffect(() => {
    if (!scope) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") rerender();
    });
    return () => subscription.remove();
  }, [scope]);

  return entry?.ingredients ?? NO_USE_UP_INGREDIENTS;
}
