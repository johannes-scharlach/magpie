import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";

import { pool } from "./db.js";
import { assertListMember } from "./list-authorization.js";
import { loadRecommendationState } from "./meal-recommendation-store.js";
import { recommendMeals, type MealCandidate } from "./meal-recommendations.js";

export const ReminderDay = z.object({
  listId: z.uuid(),
  date: z.iso.date(),
});

export type ReminderDay = z.infer<typeof ReminderDay>;
type PickedMeal = Pick<
  MealCandidate,
  "id" | "recipeId" | "seedKey" | "name" | "totalTime"
>;

export function recommendationCards(meals: MealCandidate[]): PickedMeal[] {
  return meals.map(({ id, recipeId, seedKey, name, totalTime }) => ({
    id,
    recipeId,
    seedKey,
    name,
    totalTime,
  }));
}

async function readShortlist({ listId, date }: ReminderDay) {
  const result = await pool.query<{
    recommendations: PickedMeal[] | null;
    ranking: boolean;
  }>(
    `SELECT recommendations, created_at > now() - interval '32 seconds' AS ranking
     FROM meal_reminder_suggestions WHERE list_id = $1 AND reminder_date = $2`,
    [listId, date],
  );
  return result.rows[0];
}

export async function readReminderSuggestions(
  userId: string,
  day: ReminderDay,
) {
  await assertListMember(pool, userId, day.listId);
  const { rows } = await pool.query<{ recommendations: PickedMeal[] | null }>(
    `SELECT recommendations FROM meal_reminder_suggestions s
     WHERE s.list_id = $1 AND s.reminder_date = $2
       AND NOT EXISTS (
         SELECT 1 FROM planned_meals pm
         WHERE pm.list_id = s.list_id
           AND pm.slot_date = to_char(s.reminder_date, 'YYYY-MM-DD')
           AND pm.meal = 'dinner'
       )`,
    [day.listId, day.date],
  );
  return rows[0]?.recommendations ?? [];
}

/** Called only from the push worker. Wait for an overlapping delivery's
 * shortlist rather than reranking (or sending different picks to members). */
export async function prepareReminderSuggestion(
  userId: string,
  day: ReminderDay,
  signal: AbortSignal,
): Promise<string | null> {
  const { listId, date } = day;
  const isEmpty = async () =>
    !(
      await pool.query(
        "SELECT 1 FROM planned_meals WHERE list_id = $1 AND slot_date = $2 LIMIT 1",
        [listId, date],
      )
    ).rowCount;
  await assertListMember(pool, userId, listId);
  if (!(await isEmpty())) return null;

  const claim = await pool.query(
    `INSERT INTO meal_reminder_suggestions (list_id, reminder_date)
     VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING list_id`,
    [listId, date],
  );
  if (claim.rowCount) {
    let cards: PickedMeal[] = [];
    try {
      if (process.env.TYPESAFE_AI_API_KEY) {
        const client = await pool.connect();
        const state = await (async () => {
          try {
            return await loadRecommendationState(
              client,
              userId,
              listId,
              date,
              "dinner",
              "household",
            );
          } finally {
            client.release();
          }
        })();
        cards = recommendationCards(await recommendMeals(state, signal));
        signal.throwIfAborted();
      }
    } catch (error) {
      cards = [];
      console.error("Could not rank meal reminder suggestions", error);
    }
    await pool.query(
      `UPDATE meal_reminder_suggestions SET recommendations = $3::jsonb
       WHERE list_id = $1 AND reminder_date = $2`,
      [listId, date, JSON.stringify(cards)],
    );
    return cards[0]?.name && (await isEmpty()) ? cards[0].name : null;
  }

  for (;;) {
    const saved = await readShortlist(day);
    if (saved?.recommendations) {
      const first = saved.recommendations[0];
      return first && (await isEmpty()) ? first.name : null;
    }
    if (!saved?.ranking) return null;
    await sleep(500, undefined, { signal });
  }
}
