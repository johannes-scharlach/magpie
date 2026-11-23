import { defineMessages, type IntlShape } from "react-intl";

import { sentenceCase } from "./text";

/** The shop's aisles are app taxonomy, not household data: every household has
 *  the same IDs. The stored name stays stable and this presents it, falling
 *  back to the stored name for an unknown ID. */
const categoryMessages = defineMessages({
  produce: {
    defaultMessage: "Fruit & vegetables",
    description: "Shopping category for fresh produce.",
  },
  bakery: {
    defaultMessage: "Bread & pastries",
    description: "Shopping category for bread and baked goods.",
  },
  deli: {
    defaultMessage: "Cold cuts, cheese & deli",
    description: "Shopping category for the deli counter and cheese.",
  },
  dairy: {
    defaultMessage: "Dairy, butter & yogurt",
    description: "Shopping category for dairy products.",
  },
  meat: {
    defaultMessage: "Fresh meat & fish",
    description: "Shopping category for the fresh meat and fish counter.",
  },
  breakfast: {
    defaultMessage: "Breakfast & hot drinks",
    description: "Shopping category for breakfast goods and coffee or tea.",
  },
  grains: {
    defaultMessage: "Grain products",
    description: "Shopping category for rice, pasta, flour and other grains.",
  },
  spices: {
    defaultMessage: "Ingredients, spices & baking",
    description:
      "Shopping category for spices, baking supplies and pantry ingredients.",
  },
  snacks: {
    defaultMessage: "Snacks & sweets",
    description: "Shopping category for snacks and sweets.",
  },
  frozen: {
    defaultMessage: "Frozen & convenience",
    description: "Shopping category for frozen food and ready-made items.",
  },
  beverages: {
    defaultMessage: "Beverages",
    description: "Shopping category for drinks.",
  },
  care: {
    defaultMessage: "Care & health",
    description: "Shopping category for personal care and pharmacy items.",
  },
  household: {
    defaultMessage: "Household",
    description: "Shopping category for cleaning and household supplies.",
  },
  pets: {
    defaultMessage: "Pet supplies",
    description: "Shopping category for pet food and supplies.",
  },
  home: {
    defaultMessage: "Home & garden",
    description: "Shopping category for home and garden goods.",
  },
  other: {
    defaultMessage: "Other",
    description:
      "Shopping category for items that fit none of the other aisles.",
  },
});

export function formatCategory(
  intl: IntlShape,
  categoryId: string | null | undefined,
  categoryName: string | null | undefined,
): string | null {
  if (categoryId && categoryId in categoryMessages)
    return intl.formatMessage(
      categoryMessages[categoryId as keyof typeof categoryMessages],
    );
  return categoryName ? sentenceCase(categoryName) : null;
}
