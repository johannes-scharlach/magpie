import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { waitForVariant } from "@/db/variants";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { DisplayRecipe } from "./day-content";
import type { MealSlot } from "./slots";

const RecipeSchema = z.object({
  id: z.string(),
  recipeId: z.uuid().nullable(),
  seedKey: z.string().nullable(),
  name: z.string(),
  totalTime: z.string().nullable(),
});
const RecommendationsSchema = z.object({
  recommendations: z.array(RecipeSchema).max(10),
});
const SavedSchema = z.object({ recipeId: z.uuid(), variantId: z.uuid() });

async function request(
  path: string,
  body: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in to get suggestions.");
  const response = await fetch(`${env.apiUrl}/v1/meal-recommendations${path}`, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Could not load suggestions.");
  return response.json();
}

export type MealRecommendations = {
  recipes: DisplayRecipe[];
  loading: boolean;
  failed: boolean;
};
const empty: MealRecommendations = {
  recipes: [],
  loading: false,
  failed: false,
};

export function useMealRecommendations(listId: string | undefined) {
  const [entries, setEntries] = useState<Record<string, MealRecommendations>>(
    {},
  );
  const requests = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const active = requests.current;
    return () => {
      active.forEach((controller) => controller.abort());
      active.clear();
    };
  }, [listId]);
  const key = (date: string, slot: MealSlot) => `${listId}:${date}:${slot}`;

  const load = useCallback(
    async (date: string, slot: MealSlot) => {
      if (!listId) return;
      const k = `${listId}:${date}:${slot}`;
      if (requests.current.has(k)) return;
      const controller = new AbortController();
      requests.current.set(k, controller);
      const timeout = setTimeout(() => controller.abort(), 35000);
      setEntries((prev) => ({
        ...prev,
        [k]: { recipes: [], loading: true, failed: false },
      }));
      try {
        const result = RecommendationsSchema.parse(
          await request("", { listId, date, slot }, controller.signal),
        );
        if (requests.current.get(k) === controller) {
          setEntries((prev) => ({
            ...prev,
            [k]: {
              recipes: result.recommendations,
              loading: false,
              failed: false,
            },
          }));
        }
      } catch {
        if (requests.current.get(k) === controller) {
          setEntries((prev) => ({
            ...prev,
            [k]: { recipes: [], loading: false, failed: true },
          }));
        }
      } finally {
        clearTimeout(timeout);
        if (requests.current.get(k) === controller) requests.current.delete(k);
      }
    },
    [listId],
  );

  return {
    get: (date: string, slot: MealSlot) => entries[key(date, slot)] ?? empty,
    load,
  };
}

/** Save bundled content only on selection, then let the normal local planner handle it. */
export async function prepareRecommendedMeal(
  listId: string,
  recipe: DisplayRecipe,
): Promise<DisplayRecipe> {
  let selected = recipe;
  if (recipe.seedKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const saved = SavedSchema.parse(
        await request(
          "/seed",
          { listId, seedKey: recipe.seedKey },
          controller.signal,
        ),
      );
      selected = {
        ...recipe,
        id: saved.variantId,
        recipeId: saved.recipeId,
        seedKey: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
  if (!(await waitForVariant(selected.id)))
    throw new Error("The recipe hasn't synced yet. Try again in a moment.");
  return selected;
}
