import {
  matchRecipeSearch,
  mealIngredients,
  mealSizing,
  resolveMealItem,
  type MealSwaps,
  type RecipeSearchMatch,
  type SizedFor,
} from "@magpie/meals";
import { cuisineLabel, portionTargetKcal } from "@magpie/profile";
import type { Client } from "pg";

import { inTransaction, pool } from "./db.js";
import {
  AppError,
  UnknownHouseholdPersonError,
  VariantNotFoundError,
} from "./errors.js";
import { magpieUuidV5 } from "./magpie-uuid.js";
import { assertListMemberUntilCommit } from "./list-authorization.js";
import type { CookRecipeInput } from "./recipe-schema.js";
import type { RecipeChat } from "./recipe-chat.js";
import type { ShoppingItem } from "./shopping-revision.js";
import { repointMealVariant } from "./reconcile-meal-shopping.js";
import { findVariantIdentity, insertVariant, variantUrl } from "./variants.js";

type VariantRow = {
  id: string;
  recipe_id: string;
  name: string;
  description: string | null;
  created_at: Date;
  recipe_yield: string | null;
  total_time: string | null;
  sized_for: SizedFor | null;
  ingredient_lines: CookRecipeInput["recipeIngredient"];
  instructions: CookRecipeInput["recipeInstructions"];
  locale: string;
  content_markdown: string | null;
  cuisine: string | null;
  tags: string[];
  equipment: string[];
  effort: string | null;
};

type SearchVariantRow = Omit<VariantRow, "locale" | "content_markdown">;

const searchFields = `id, recipe_id, name, description, created_at, recipe_yield,
  total_time, sized_for, ingredient_lines, instructions,
  equipment, effort,
  (SELECT cuisine FROM recipes WHERE recipes.id = variants.recipe_id) AS cuisine,
  (SELECT tags FROM recipes WHERE recipes.id = variants.recipe_id) AS tags`;
const dbFields = `${searchFields}, locale, content_markdown`;

/** Resolve the cooking brief before the agent writes quantities; the result is a snapshot. */
export async function readChatSizing(
  client: Client,
  listId: string,
  request: { meal: string; eaterIds?: string[]; extraPortions: number },
) {
  const { rows: people } = await client.query<{
    id: string;
    name: string;
    portion_reference: number;
  }>(
    "SELECT id, name, portion_reference FROM household_people WHERE list_id = $1 ORDER BY id",
    [listId],
  );
  const eaterIds = [...new Set(request.eaterIds ?? people.map((p) => p.id))];
  if (eaterIds.some((id) => !people.some((p) => p.id === id)))
    throw new UnknownHouseholdPersonError();
  const sizedFor = mealSizing(
    {
      meal: request.meal,
      eater_ids: eaterIds,
      extra_portions: request.extraPortions,
    },
    people,
  );
  const calorieBacked = sizedFor.total_target_kcal !== undefined;
  return {
    meal: request.meal,
    eaters: people
      .filter((p) => eaterIds.includes(p.id))
      .map((p) => ({
        ...p,
        ...(calorieBacked
          ? { target_kcal: portionTargetKcal(p.portion_reference) }
          : {}),
      })),
    extra: {
      helpings: request.extraPortions,
      ...(calorieBacked
        ? { target_kcal: portionTargetKcal(request.extraPortions) }
        : {}),
    },
    sizedFor,
  };
}

async function sizing(client: Client, listId: string, value: SizedFor | null) {
  if (!value) return null;
  const people = await client.query<{ id: string; name: string }>(
    "SELECT id, name FROM household_people WHERE list_id = $1 AND id = ANY($2::uuid[])",
    [listId, value.eater_ids],
  );
  return {
    eaterIds: value.eater_ids,
    eaters: people.rows,
    extraPortions: value.extra_portions,
    ...(value.total_target_kcal !== undefined
      ? { totalTargetKcal: value.total_target_kcal }
      : {}),
  };
}

async function summary(client: Client, listId: string, row: SearchVariantRow) {
  return {
    variantId: row.id,
    recipeId: row.recipe_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    yield: row.recipe_yield,
    totalTime: row.total_time,
    sizedFor: await sizing(client, listId, row.sized_for),
    url: variantUrl(row.id),
  };
}

export async function readChatVariant(
  client: Client,
  listId: string,
  variantId: string,
) {
  const row = (
    await client.query<VariantRow>(
      `SELECT ${dbFields} FROM variants WHERE id = $1 AND list_id = $2`,
      [variantId, listId],
    )
  ).rows[0];
  if (!row) throw new VariantNotFoundError();
  return {
    ...(await summary(client, listId, row)),
    recipeIngredient: row.ingredient_lines,
    recipeInstructions: row.instructions,
    locale: row.locale,
    contentMarkdown: row.content_markdown,
    recipeCuisine: row.cuisine,
    tags: row.tags,
    equipment: row.equipment,
    effort: row.effort,
  };
}

type History = {
  times_planned: number;
  last_planned: string | null;
  recipe_times_planned: number;
  recipe_last_planned: string | null;
};

/** Past plans only; what is coming up is readPlan's. */
const historyFields = `
  (SELECT count(*)::int FROM planned_meals p WHERE p.list_id = $1
     AND p.slot_date < $3 AND p.variant_id = variants.id) AS times_planned,
  (SELECT max(p.slot_date) FROM planned_meals p WHERE p.list_id = $1
     AND p.slot_date < $3 AND p.variant_id = variants.id) AS last_planned,
  (SELECT count(*)::int FROM planned_meals p WHERE p.list_id = $1
     AND p.slot_date < $3 AND p.recipe_id = variants.recipe_id) AS recipe_times_planned,
  (SELECT max(p.slot_date) FROM planned_meals p WHERE p.list_id = $1
     AND p.slot_date < $3 AND p.recipe_id = variants.recipe_id) AS recipe_last_planned`;

/** Match with the cookbook's rule. Discovery spends its limit on recipes,
 * standards first: the most planned recipe, shown by its most planned
 * matching variant. A recipeId expands variants instead. Other matches
 * contribute counts only. */
export async function searchChatVariants(
  listId: string,
  opts: {
    query: string;
    recipeId?: string;
    limit: number;
    offset: number;
    today: string;
  },
) {
  const client = await pool.connect();
  try {
    // Fetch search fields, not full recipe context. Filtering and limiting in
    // SQL would duplicate the shared rule and could discard matching recipes.
    const rows = await client.query<SearchVariantRow & History>(
      `SELECT ${searchFields}, ${historyFields} FROM variants
        WHERE list_id = $1 AND ($2::uuid IS NULL OR recipe_id = $2)
        ORDER BY times_planned DESC, created_at DESC, id`,
      [listId, opts.recipeId ?? null, opts.today],
    );
    const counts = new Map<
      string,
      { variantCount: number; matchingVariantCount: number }
    >();
    const seen = new Set<string>();
    const candidates: {
      row: SearchVariantRow & History;
      matches: RecipeSearchMatch[];
    }[] = [];
    for (const row of rows.rows) {
      const count = counts.get(row.recipe_id) ?? {
        variantCount: 0,
        matchingVariantCount: 0,
      };
      counts.set(row.recipe_id, count);
      count.variantCount++;
      const matches = matchRecipeSearch(row, opts.query);
      if (matches === null) continue;
      count.matchingVariantCount++;
      if (!opts.recipeId && seen.has(row.recipe_id)) continue;
      seen.add(row.recipe_id);
      candidates.push({ row, matches });
    }
    if (!opts.recipeId)
      candidates.sort(
        (a, b) =>
          b.row.recipe_times_planned - a.row.recipe_times_planned ||
          b.row.created_at.getTime() - a.row.created_at.getTime() ||
          a.row.id.localeCompare(b.row.id),
      );
    const query = opts.query.trim().toLowerCase();
    const end = opts.offset + opts.limit;
    const variants = await Promise.all(
      candidates.slice(opts.offset, end).map(async ({ row, matches }) => {
        return {
          ...(await summary(client, listId, row)),
          cuisine: row.cuisine && cuisineLabel(row.cuisine),
          tags: row.tags,
          equipment: row.equipment,
          effort: row.effort,
          ...counts.get(row.recipe_id)!,
          timesPlanned: row.times_planned,
          lastPlanned: row.last_planned,
          recipeTimesPlanned: row.recipe_times_planned,
          recipeLastPlanned: row.recipe_last_planned,
          matches: matches.slice(0, 4).map(({ field, text }) => {
            const start = Math.max(0, text.toLowerCase().indexOf(query) - 60);
            return { field, excerpt: text.slice(start, start + 240) };
          }),
        };
      }),
    );
    return { variants, hasMore: candidates.length > end };
  } finally {
    client.release();
  }
}

/** What the cookbook holds, most common first, before searching it. */
export async function readCookbookOverview(listId: string) {
  const client = await pool.connect();
  try {
    const cuisines = await client.query<{ cuisine: string; recipes: number }>(
      `SELECT cuisine, count(*)::int AS recipes FROM recipes
        WHERE list_id = $1 AND cuisine IS NOT NULL
        GROUP BY cuisine ORDER BY recipes DESC, cuisine`,
      [listId],
    );
    const tags = await client.query<{ tag: string; recipes: number }>(
      `SELECT tag, count(DISTINCT id)::int AS recipes
        FROM recipes, jsonb_array_elements_text(tags) AS tag
        WHERE list_id = $1 GROUP BY tag ORDER BY recipes DESC, tag`,
      [listId],
    );
    return {
      cuisines: cuisines.rows.map(({ cuisine, recipes }) => ({
        cuisine: cuisineLabel(cuisine),
        recipes,
      })),
      tags: tags.rows,
    };
  } finally {
    client.release();
  }
}

export async function readChatMeal(
  client: Client,
  listId: string,
  plannedMealId: string,
) {
  const meal = (
    await client.query<{
      id: string;
      recipe_id: string | null;
      variant_id: string | null;
      name: string | null;
      content_id: string;
      slot_date: string;
      meal: string;
      eater_ids: string[];
      extra_portions: number;
      ingredient_swaps: MealSwaps;
    }>("SELECT * FROM planned_meals WHERE id = $1 AND list_id = $2", [
      plannedMealId,
      listId,
    ])
  ).rows[0];
  if (!meal)
    throw new AppError(
      "PLANNED_MEAL_NOT_FOUND",
      "This meal is no longer on this household's plan.",
      404,
    );
  const items = (
    await client.query<ShoppingItem>(
      "SELECT id, name, spec, category_id, status, ingredient_id FROM list_items WHERE planned_meal_id = $1 ORDER BY created_at, id",
      [meal.id],
    )
  ).rows;
  const variant = meal.variant_id
    ? await readChatVariant(client, listId, meal.variant_id)
    : null;
  const lines = variant?.recipeIngredient ?? [];
  return {
    ...meal,
    ingredientChoices: mealIngredients(lines, meal.ingredient_swaps),
    sizedFor: await sizing(client, listId, {
      eater_ids: meal.eater_ids,
      extra_portions: meal.extra_portions,
    }),
    items: items.map((item) =>
      resolveMealItem(item, lines, meal.ingredient_swaps),
    ),
  };
}

/** One user turn and base version identify a write, including retries after
 * a lost stream. Meal repointing and shopping changes commit with the variant. */
export async function writeChatVariant(opts: {
  userId: string;
  listId: string;
  chatId: string;
  messageId: string;
  chat: RecipeChat;
  today: string;
  baseVariantId: string;
  recipe: CookRecipeInput;
  sizedFor?: SizedFor;
}) {
  return inTransaction(opts.userId, async (client) => {
    await assertListMemberUntilCommit(client, opts.userId, opts.listId);
    const variantId = magpieUuidV5(
      `chat:${opts.chatId}:${opts.messageId}:${opts.baseVariantId}`,
    );
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [variantId],
    );
    const existing = await findVariantIdentity(client, variantId);
    if (existing) {
      const variant = await readChatVariant(client, opts.listId, variantId);
      return {
        variantId,
        name: variant.name,
        url: variantUrl(variantId),
        alreadySaved: true,
      };
    }
    // Only this household's recipes take new versions (ADR 27).
    const base = await readChatVariant(client, opts.listId, opts.baseVariantId);
    if (opts.sizedFor) {
      const people = await client.query<{ id: string }>(
        "SELECT id FROM household_people WHERE list_id = $1",
        [opts.listId],
      );
      if (
        opts.sizedFor.eater_ids.some(
          (id) => !people.rows.some((person) => person.id === id),
        )
      )
        throw new UnknownHouseholdPersonError();
    }
    await insertVariant(client, {
      recipeId: base.recipeId,
      variantId,
      recipe: opts.recipe,
      baseVariantId: opts.baseVariantId,
      sizedFor:
        opts.sizedFor ??
        (base.sizedFor
          ? {
              eater_ids: base.sizedFor.eaterIds,
              extra_portions: base.sizedFor.extraPortions,
              ...(base.sizedFor.totalTargetKcal !== undefined
                ? { total_target_kcal: base.sizedFor.totalTargetKcal }
                : {}),
            }
          : undefined),
    });
    let plannedMeal: { id: string; date: string; meal: string } | null = null;
    let shopping: Awaited<ReturnType<typeof repointMealVariant>> | null = null;
    if (opts.chat.planned_meal_id && opts.chat.recipe_id === base.recipeId) {
      const meal = (
        await client.query<{
          id: string;
          slot_date: string;
          meal: string;
          variant_id: string;
        }>(
          "SELECT id, slot_date, meal, variant_id FROM planned_meals WHERE id = $1 AND list_id = $2 AND recipe_id = $3 AND slot_date >= $4 FOR UPDATE",
          [opts.chat.planned_meal_id, opts.listId, base.recipeId, opts.today],
        )
      ).rows[0];
      if (meal) {
        shopping = await repointMealVariant(client, {
          mealId: meal.id,
          variantId,
          expectedVariantId: meal.variant_id,
        });
        plannedMeal = { id: meal.id, date: meal.slot_date, meal: meal.meal };
      }
    }
    return {
      variantId,
      name: opts.recipe.name,
      url: variantUrl(variantId),
      plannedMeal,
      shopping,
    };
  });
}
