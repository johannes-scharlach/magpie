import type { Effort } from "@magpie/meals";
import { defineMessage, type IntlShape } from "react-intl";

const effortMessages = {
  "no-cooking": defineMessage({
    defaultMessage: "No cooking",
    description:
      "Recipe effort level for a dish assembled without heat, such as a salad or a sandwich.",
  }),
  easy: defineMessage({
    defaultMessage: "Easy",
    description: "Recipe effort level: little work, few steps.",
  }),
  normal: defineMessage({
    defaultMessage: "Normal",
    description: "Recipe effort level: an ordinary weeknight dish.",
  }),
  "more-work": defineMessage({
    defaultMessage: "More work",
    description:
      "Recipe effort level: more steps or attention than an ordinary weeknight dish.",
  }),
  "big-project": defineMessage({
    defaultMessage: "Big project",
    description:
      "Recipe effort level: a long or involved cook, such as a weekend bake.",
  }),
};

/** Presentation of a recipe's effort level. The stored value stays stable. */
export function formatEffort(
  intl: IntlShape,
  effort: string | null | undefined,
): string | null {
  return effort && effort in effortMessages
    ? intl.formatMessage(effortMessages[effort as Effort])
    : null;
}
