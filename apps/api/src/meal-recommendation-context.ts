import seeds from "@magpie/meals/seeded-recipes.json" with { type: "json" };
import {
  cuisinesContext,
  dietDescriptions,
  dietRequests,
  goalRulesContext,
  selectionLabels,
  shopRulesContext,
  staplesContext,
  type Household,
} from "@magpie/profile";

import { RecipeSchema, type RecipeInput } from "./recipe-schema.js";
import type { MealCandidate } from "./meal-recommendations.js";
import { AppError } from "./errors.js";

export function recommendationHousehold({
  profile,
  people,
}: Household): Record<string, unknown> {
  const personKey = (id: string) => {
    const index = people.findIndex((p) => p.id === id);
    return index < 0 ? "unknown person" : `person ${index + 1}`;
  };
  return {
    people: people.map((p, i) => ({
      person: `person ${i + 1}`,
      ageGroup: p.age_group,
      diet:
        p.diet === "other"
          ? p.diet_other
          : `${dietRequests[p.diet]}: ${dietDescriptions[p.diet]}`,
    })),
    restrictions: profile.restrictions,
    ingredientAvoidances: profile.ingredient_avoidances.map((a) => ({
      ...a,
      person_ids: a.person_ids?.map(personKey),
    })),
    equipment: selectionLabels("kitchen_equipment", profile.kitchen_equipment),
    goals: goalRulesContext(profile),
    brief: profile.meal_ideas_brief,
    dayHabits: profile.day_habits,
    cuisines: cuisinesContext(profile),
    usualIngredients: staplesContext(profile),
    sourcing: shopRulesContext(profile),
  };
}

/** No duplication to pad a short library to 100. Cookbook order is newest first. */
export function recommendationCandidates(
  cookbook: MealCandidate[],
  seeded: MealCandidate[],
): MealCandidate[] {
  const saved = cookbook.slice(0, 80);
  const names = new Set(saved.map((c) => c.name.trim().toLowerCase()));
  return [
    ...saved,
    ...seeded
      .filter((c) => !names.has(c.name.trim().toLowerCase()))
      .slice(0, 100 - saved.length),
  ];
}

export function seededCandidates(): MealCandidate[] {
  return Object.entries(seeds).map(([key, r]) => ({
    id: `seed:${key}`,
    recipeId: null,
    seedKey: key,
    name: r.title,
    description: r.description,
    totalTime: r.total_time,
    cuisine: r.cuisine,
    tags: [],
    equipment: r.equipment,
    effort: r.effort,
    ingredients: r.ingredient_lines.map((line) => line.item_name),
    mealFamily: `seed:${r.parent_idea}`,
  }));
}

const seededFamilies = new Map(
  Object.values(seeds).map((r) => [
    r.title.trim().toLowerCase(),
    `seed:${r.parent_idea}`,
  ]),
);

/** Saved bundled recipes retain their base idea; ordinary variants share a recipe. */
export function mealFamily(
  name: string,
  recipeId: string | null,
): string | null {
  return (
    seededFamilies.get(name.trim().toLowerCase()) ??
    (recipeId ? `recipe:${recipeId}` : null)
  );
}

/** Normalize the older bundled format at its boundary, without changing its content. */
export function seededMeal(key: string): RecipeInput {
  const r = (seeds as Record<string, (typeof seeds)[keyof typeof seeds]>)[key];
  if (!r)
    throw new AppError(
      "SEED_NOT_FOUND",
      "This idea is no longer available.",
      404,
    );
  return RecipeSchema.parse({
    name: r.title,
    description: r.description,
    locale: "en",
    totalTime: r.total_time,
    recipeYield: r.recipe_yield,
    recipeCuisine: r.cuisine,
    tags: [],
    equipment: r.equipment,
    effort: r.effort,
    recipeIngredient: r.ingredient_lines,
    recipeInstructions: r.instructions.map((step) => ({
      ...step,
      ingredients: step.ingredients.map((ingredient) =>
        typeof ingredient === "string"
          ? { qty_text: null, item_name: ingredient }
          : ingredient,
      ),
    })),
  });
}
