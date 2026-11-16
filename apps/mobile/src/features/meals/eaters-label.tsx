import { defineMessages, useIntl } from "react-intl";

import { whoIsEating, type Eater } from "./eaters";

const messages = defineMessages({
  everyone: {
    defaultMessage: "Everyone",
    description:
      "Badge on a planned meal when every household member is eating it.",
  },
  nobody: {
    defaultMessage: "Nobody",
    description:
      "Badge on a planned meal when no current household member is eating it.",
  },
  me: {
    defaultMessage: "Me",
    description: "The current user inside a list of people eating a meal.",
  },
});

type EatersLabelOptions = {
  people: Eater[];
  eaterIds: string[];
  extraPortions: number;
};

/** Format a meal's eaters with the active locale, including extra portions. */
export function useEatersLabel() {
  const intl = useIntl();

  return ({ people, eaterIds, extraPortions }: EatersLabelOptions) => {
    const { eating, everyone } = whoIsEating(people, eaterIds);
    const who = everyone
      ? intl.formatMessage(messages.everyone)
      : eating.length
        ? eating
            .map((person) =>
              person.self ? intl.formatMessage(messages.me) : person.name,
            )
            .join(", ")
        : intl.formatMessage(messages.nobody);

    if (extraPortions <= 0) return who;
    return `${who} ${intl.formatMessage(
      {
        defaultMessage: "+{extra} extra",
        description:
          "Suffix on a meal badge for food beyond the named eaters, such as guests or leftovers.",
      },
      {
        extra: intl.formatNumber(extraPortions, { maximumFractionDigits: 2 }),
      },
    )}`;
  };
}
