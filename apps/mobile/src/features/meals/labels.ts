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
});
