import { defineMessage, defineMessages, type IntlShape } from "react-intl";

import {
  addDays,
  dateKey,
  SLOT_ORDER,
  type MealSlot,
  type MealTarget,
} from "./slots";

/** Standalone slot labels, used as headings and badges. */
export const slotMessages = defineMessages({
  lunch: {
    defaultMessage: "Lunch",
    description: "Meal slot label for the midday meal.",
  },
  dinner: {
    defaultMessage: "Dinner",
    description: "Meal slot label for the evening meal.",
  },
  treat: {
    defaultMessage: "Treat",
    description: "Meal slot label for a snack or treat.",
  },
});

export function formatMealTarget(intl: IntlShape, { date, slot }: MealTarget) {
  return intl.formatMessage(
    {
      defaultMessage: "{meal} · {date}",
      description:
        "Label for a fixed meal slot. {meal} is the standalone Lunch, Dinner or Treat label; {date} is the formatted calendar date.",
    },
    {
      meal: intl.formatMessage(slotMessages[slot]),
      date: intl.formatDate(new Date(`${date}T12:00:00`), {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    },
  );
}

/** Action row and heading that open the meal chooser for a slot. */
export const selectSlotMessages = defineMessages({
  lunch: {
    defaultMessage: "Select lunch",
    description:
      "Action row that opens the meal chooser for lunch, and the heading shown while it is open. Does not plan a meal yet.",
  },
  dinner: {
    defaultMessage: "Select dinner",
    description:
      "Action row that opens the meal chooser for dinner, and the heading shown while it is open. Does not plan a meal yet.",
  },
  treat: {
    defaultMessage: "Select a treat",
    description:
      "Action row that opens the meal chooser for a treat, and the heading shown while it is open. Does not plan a meal yet.",
  },
});

/** Accessibility label for closing the chooser for a slot. */
export const hideSlotChoicesMessages = defineMessages({
  lunch: {
    defaultMessage: "Hide lunch choices",
    description:
      "Accessibility label for the control that closes the lunch meal chooser. Does not change the planned meal.",
  },
  dinner: {
    defaultMessage: "Hide dinner choices",
    description:
      "Accessibility label for the control that closes the dinner meal chooser. Does not change the planned meal.",
  },
  treat: {
    defaultMessage: "Hide treat choices",
    description:
      "Accessibility label for the control that closes the treat meal chooser. Does not change the planned meal.",
  },
});

/** Accessibility label for choosing a recommended dish for a slot. */
export const selectRecipeForSlotMessages = defineMessages<{
  lunch: { recipe: string };
  dinner: { recipe: string };
  treat: { recipe: string };
}>({
  lunch: {
    defaultMessage: "Select {recipe} for lunch",
    description:
      "Accessibility label for a recommended dish that will fill the lunch slot. {recipe} is the recipe's display name. Selecting it plans the recipe for lunch.",
  },
  dinner: {
    defaultMessage: "Select {recipe} for dinner",
    description:
      "Accessibility label for a recommended dish that will fill the dinner slot. {recipe} is the recipe's display name. Selecting it plans the recipe for dinner.",
  },
  treat: {
    defaultMessage: "Select {recipe} for a treat",
    description:
      "Accessibility label for a recommended dish that will fill the treat slot. {recipe} is the recipe's display name. Selecting it plans the recipe as a treat.",
  },
});

export const dayMessages = defineMessages({
  today: {
    defaultMessage: "Today",
    description: "Label for the current day in the date strip and day heading.",
  },
  tomorrow: {
    defaultMessage: "Tomorrow",
    description:
      "Label for the day after today in a planned meal's heading, such as “Tomorrow · Dinner”.",
  },
  yesterday: {
    defaultMessage: "Yesterday",
    description:
      "Label for a planned meal from the day before today, in that meal's heading.",
  },
});

/** Heading for a planned meal: its day, then its slot. */
export const mealHeadingMessage = defineMessage<{ day: string; slot: string }>(
  {
    defaultMessage: "{day} · {slot}",
    description:
      "Heading for a planned meal, such as “Today · Dinner” or “Thursday, 10 Sep · Dinner”. {day} is a formatted day or Today, Tomorrow, Yesterday. {slot} is the standalone Lunch, Dinner or Treat label. The two parts may be reordered.",
  },
  { typed: true },
);

/** Where a planned meal sits, as a standalone phrase: “Dinner on Tuesday”. */
export const plannedWhenMessages = defineMessages<{
  lunch: { day: string };
  dinner: { day: string };
  treat: { day: string };
}>(
  {
    lunch: {
      defaultMessage: "Lunch on {day}",
      description:
        "Source of a shopping item that belongs to a planned meal. {day} is a formatted weekday such as Tuesday. Selecting it opens the meal.",
    },
    dinner: {
      defaultMessage: "Dinner on {day}",
      description:
        "Source of a shopping item that belongs to a planned meal. {day} is a formatted weekday such as Tuesday. Selecting it opens the meal.",
    },
    treat: {
      defaultMessage: "Treat on {day}",
      description:
        "Source of a shopping item that belongs to a planned meal. {day} is a formatted weekday such as Tuesday. Selecting it opens the meal.",
    },
  },
  { typed: true },
);

/** A planned day as a standalone label: Today, Tomorrow, Yesterday, a weekday,
 *  or a date when it is further out. */
export function formatDayLabel(
  intl: IntlShape,
  key: string,
  today: Date = new Date(),
): string | null {
  if (!key) return null;
  const todayKey = dateKey(today);
  if (key === todayKey) return intl.formatMessage(dayMessages.today);
  if (key === dateKey(addDays(today, 1)))
    return intl.formatMessage(dayMessages.tomorrow);
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  if (key < todayKey) {
    if (key === dateKey(addDays(today, -1)))
      return intl.formatMessage(dayMessages.yesterday);
    return intl.formatDate(date, {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    });
  }
  // Beyond a week the weekday alone could name two meals.
  return key >= dateKey(addDays(today, 7))
    ? intl.formatDate(date, { weekday: "long", day: "numeric", month: "short" })
    : intl.formatDate(date, { weekday: "long" });
}

/** Standalone slot label, such as Dinner. */
export function formatSlotLabel(intl: IntlShape, slot: MealSlot) {
  return intl.formatMessage(slotMessages[slot]);
}

/** “Dinner on Tuesday”, or null when the meal has no date or slot. */
export function formatPlannedWhen(
  intl: IntlShape,
  date: string | null,
  meal: string | null,
): string | null {
  const slot = SLOT_ORDER.find((value) => value === meal);
  if (!date || !slot) return null;
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const day = intl.formatDate(parsed, { weekday: "long" });
  return intl.formatMessage(plannedWhenMessages[slot], { day });
}
