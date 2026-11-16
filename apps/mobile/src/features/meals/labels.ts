import { defineMessages } from "react-intl";

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

/** Slot names inside a sentence. English keeps them lowercase. */
export const slotInlineMessages = defineMessages({
  lunch: {
    defaultMessage: "lunch",
    description:
      "Meal slot name inside a sentence. English keeps it lowercase; languages that capitalise nouns keep their normal capitalisation.",
  },
  dinner: {
    defaultMessage: "dinner",
    description:
      "Meal slot name inside a sentence. English keeps it lowercase; languages that capitalise nouns keep their normal capitalisation.",
  },
  treat: {
    defaultMessage: "treat",
    description:
      "Meal slot name inside a sentence. English keeps it lowercase; languages that capitalise nouns keep their normal capitalisation.",
  },
});

export const dayMessages = defineMessages({
  today: {
    defaultMessage: "Today",
    description: "Label for the current day in the date strip and day heading.",
  },
});
