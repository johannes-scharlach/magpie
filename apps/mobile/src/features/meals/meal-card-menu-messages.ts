import { defineMessages } from "react-intl";

export const mealCardMenuMessages = defineMessages({
  planAgain: {
    defaultMessage: "Plan again…",
    description: "Menu action that plans the same meal again on another day.",
  },
  chooseAnother: {
    defaultMessage: "Choose another meal",
    description: "Menu action that replaces the planned meal.",
  },
  move: {
    defaultMessage: "Move to…",
    description:
      "Menu action that moves the planned meal to another day or slot.",
  },
  remove: {
    defaultMessage: "Remove from plan",
    description: "Destructive menu action that removes the meal from the plan.",
  },
});
