import { defineMessages, type IntlShape } from "react-intl";
import { z } from "zod";

import { formatPickerIngredient } from "@/features/ingredients/ingredient-labels";
import { mealTarget, type MealTarget } from "@/features/meals/slots";

export type OnHandEntry = {
  target: MealTarget;
  ingredients: readonly string[];
  note: string;
};

const entrySchema = z.object({
  target: z.object({ date: z.string(), slot: z.string() }),
  ingredients: z.array(z.string()),
  note: z.string(),
});

export function readOnHandEntry(value: unknown): OnHandEntry | null {
  const result = entrySchema.safeParse(value);
  if (!result.success) return null;
  const { target, ...rest } = result.data;
  const meal = mealTarget(target.date, target.slot);
  return meal ? { ...rest, target: meal } : null;
}

const targetMessages = defineMessages<{
  lunch: { date: string };
  dinner: { date: string };
  treat: { date: string };
}>(
  {
    lunch: {
      defaultMessage: "Help me decide what to make for lunch on {date}.",
      description:
        "First user bubble in the on-hand chat for lunch. {date} is a formatted calendar date.",
    },
    dinner: {
      defaultMessage: "Help me decide what to make for dinner on {date}.",
      description:
        "First user bubble in the on-hand chat for dinner. {date} is a formatted calendar date.",
    },
    treat: {
      defaultMessage: "Help me decide what treat to make on {date}.",
      description:
        "First user bubble in the on-hand chat for a snack or treat. {date} is a formatted calendar date.",
    },
  },
  { typed: true },
);

export function formatOnHandTranscript(
  intl: IntlShape,
  { target, ingredients, note }: OnHandEntry,
): string {
  const date = intl.formatDate(new Date(`${target.date}T12:00:00`), {
    dateStyle: "medium",
  });
  const ask = intl.formatMessage(targetMessages[target.slot], { date });
  const picked = ingredients.length
    ? intl.formatMessage(
        {
          defaultMessage: "I have: {ingredients}.",
          description:
            "User bubble stating only the ingredients the user selected. {ingredients} is a localized list of ingredient names.",
        },
        {
          ingredients: intl.formatList(
            ingredients.map((label) => formatPickerIngredient(intl, label)),
          ),
        },
      )
    : "";
  return [ask, picked, note].filter(Boolean).join("\n");
}
