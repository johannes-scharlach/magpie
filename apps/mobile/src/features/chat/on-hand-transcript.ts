import { defineMessages, type IntlShape } from "react-intl";
import { z } from "zod";

import { formatPickerIngredient } from "@/features/ingredients/ingredient-labels";
import { mealTarget, type MealTarget } from "@/features/meals/slots";

import type { Parts } from "./stream";

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

export function onHandEntryFromParts(parts: Parts) {
  return readOnHandEntry(
    parts.find((part) => part.type === "data-onHandEntry")?.data,
  );
}

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

export function formatOnHandIngredients(
  intl: IntlShape,
  ingredients: readonly string[],
): string {
  const labels = ingredients.map((label) =>
    formatPickerIngredient(intl, label),
  );
  return labels.length > 1 && typeof Intl.ListFormat === "function"
    ? new Intl.ListFormat(intl.locale).format(labels)
    : labels.join(", ");
}

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
          defaultMessage: "I’d like to use up {ingredients}.",
          description:
            "User bubble naming the selected ingredients the cook wants to put to use. They may have them now or expect to have them by the planned meal. {ingredients} is a localized list of ingredient names.",
        },
        {
          ingredients: formatOnHandIngredients(intl, ingredients),
        },
      )
    : "";
  return [ask, picked, note].filter(Boolean).join("\n");
}
