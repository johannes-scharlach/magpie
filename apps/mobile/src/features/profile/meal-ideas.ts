import {
  habitSlots,
  mealIdeasForSlots,
  weekdays,
  type MealIdeaSlot,
} from "@magpie/profile";

// Lunch is the first row, dinner the second; each runs Monday–Sunday.
export function mealSlotsMask(slots: readonly MealIdeaSlot[]): number {
  return slots.reduce(
    (mask, { day, meal }) =>
      mask | (1 << (habitSlots.indexOf(meal) * 7 + weekdays.indexOf(day))),
    0,
  );
}

export function mealSlotsFromMask(mask: number): MealIdeaSlot[] {
  return habitSlots.flatMap((meal, row) =>
    weekdays.flatMap((day, column) =>
      mask & (1 << (row * 7 + column)) ? [{ day, meal }] : [],
    ),
  );
}

// Recognise only sentences made by our picker, never infer a schedule from prose.
const openings = new Map<string, MealIdeaSlot[]>();
for (let days = 1; days < 128; days++) {
  for (const mask of [days, days << 7, days | (days << 7)]) {
    const slots = mealSlotsFromMask(mask);
    openings.set(mealIdeasForSlots(slots), slots);
  }
}

export function readMealIdeasSelection(value: string): {
  opening: string | null;
  slots: MealIdeaSlot[];
} {
  const opening = value.slice(0, value.indexOf(".") + 1);
  let slots = openings.get(opening);
  if (!slots) {
    const [lunch, dinner] = opening.split(", and dinner ");
    const lunches = openings.get(`${lunch}.`);
    const dinners =
      dinner && openings.get(`We’d like some ideas for dinner ${dinner}`);
    if (lunches && dinners) slots = [...lunches, ...dinners];
  }
  return slots && mealIdeasForSlots(slots) === opening
    ? { opening, slots }
    : { opening: null, slots: [] };
}

/** Meal coverage belongs to the grid, not in the editable household notes. */
export function mealIdeasDetail(value: string): string {
  const { opening } = readMealIdeasSelection(value);
  return opening ? value.slice(opening.length).trimStart() : value;
}

export function changeMealIdeasDetail(value: string, detail: string): string {
  const { opening } = readMealIdeasSelection(value);
  return opening ? [opening, detail].filter(Boolean).join("\n\n") : detail;
}

/** Replace only the generated opening; preserve all household-written detail. */
export function changeMealIdeasOpening(
  value: string,
  previous: string | null,
  next: string,
): string {
  if (!value.trim()) return next;
  if (previous && value.startsWith(previous)) {
    const detail = value.slice(previous.length);
    return next ? next + detail : detail.trimStart();
  }
  return next ? `${next}\n\n${value}` : value;
}
