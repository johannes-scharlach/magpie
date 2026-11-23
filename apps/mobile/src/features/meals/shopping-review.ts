import { defineMessage, defineMessages, type IntlShape } from "react-intl";

import {
  ingredientOptions,
  isWithout,
  mealIngredients,
  type IngredientLine,
  type MealItem,
  type MealSwaps,
} from "@magpie/meals";

export { ingredientSpec } from "@magpie/meals";
export const optionsForLine = ingredientOptions;

export function probablyAtHome(line: IngredientLine): boolean {
  return line.shopping_hint === "check_at_home";
}

export type IngredientDecision =
  "undecided" | "shop" | "bought" | "home" | "without";

/** Shopping selection and ingredient choice are independent, joined by identity.
 * A shopping row decides an ingredient; then going without; then the meal's
 * at-home marks. */
export function shoppingReview<L extends IngredientLine, I extends MealItem>(
  lines: readonly L[],
  items: readonly I[],
  swaps: MealSwaps = {},
  atHome: readonly number[] = [],
) {
  return mealIngredients(lines, swaps).map(
    ({ line, optionIndex, chosen }, index) => {
      const item =
        items.find(
          (item) => line.id != null && item.ingredient_id === line.id,
        ) ?? null;
      const decision: IngredientDecision = item
        ? item.status === "purchased"
          ? "bought"
          : "shop"
        : isWithout(chosen)
          ? "without"
          : line.id != null && atHome.includes(line.id)
            ? "home"
            : "undecided";
      return {
        index,
        line,
        optionIndex,
        item,
        decision,
        likelyHave: probablyAtHome(line),
      };
    },
  );
}

/** Lines without an id cannot be decided, so they never hold a meal open. */
export function undecidedCount(review: ReturnType<typeof shoppingReview>) {
  return review.filter(
    (entry) => entry.decision === "undecided" && entry.line.id != null,
  ).length;
}

/** What a meal still needs, or what was decided once nothing is left. */
const progressMessages = defineMessages<{
  undecided: { count: number };
  onList: { count: number };
  bought: { count: number };
  atHome: { count: number };
  skipped: { count: number };
}>(
  {
    undecided: {
      defaultMessage: "{count} to decide",
      description:
        "Status on a planned meal's shopping, while ingredients still await a decision. {count} is how many are left.",
    },
    onList: {
      defaultMessage: "{count} on the list",
      description:
        "Part of a planned meal's shopping status. {count} is how many ingredients are on the shopping list.",
    },
    bought: {
      defaultMessage: "{count} bought",
      description:
        "Part of a planned meal's shopping status. {count} is how many ingredients are already bought.",
    },
    atHome: {
      defaultMessage: "{count} at home",
      description:
        "Part of a planned meal's shopping status. {count} is how many ingredients the cook already has.",
    },
    skipped: {
      defaultMessage: "{count} skipped",
      description:
        "Part of a planned meal's shopping status. {count} is how many ingredients the cook chose to go without.",
    },
  },
  { typed: true },
);

const allHomeMessage = defineMessage<Record<never, never>>(
  {
    defaultMessage: "All at home",
    description:
      "Status on a planned meal's shopping when every ingredient was marked as already at home.",
  },
  { typed: true },
);

export function shoppingProgress(
  intl: IntlShape,
  review: ReturnType<typeof shoppingReview>,
) {
  const undecided = undecidedCount(review);
  if (undecided)
    return intl.formatMessage(progressMessages.undecided, { count: undecided });
  const count = (decision: IngredientDecision) =>
    review.filter((entry) => entry.decision === decision).length;
  const home = count("home");
  if (home === review.length) return intl.formatMessage(allHomeMessage);
  return [
    { count: count("shop"), message: progressMessages.onList },
    { count: count("bought"), message: progressMessages.bought },
    { count: home, message: progressMessages.atHome },
    { count: count("without"), message: progressMessages.skipped },
  ]
    .filter(({ count }) => count)
    .map(({ count, message }) => intl.formatMessage(message, { count }))
    .join(" · ");
}
