import { defineMessage, type IntlShape } from "react-intl";

const ageMessage = defineMessage<{ days: number }>(
  {
    defaultMessage: "{days, plural, one {1 day ago} other {# days ago}}",
    description:
      "How long ago a planned meal was, after its slot in a shopping row. {days} is a count of calendar days, 1 or more. Keep it short and lowercase.",
  },
  { typed: true },
);

/** Count calendar days, not elapsed 24-hour periods (which break across DST).
 * Dates are local YYYY-MM-DD keys, not instants from the server. */
export function mealAge(
  intl: IntlShape,
  slotDate: string | null,
  today: string,
): string | null {
  if (!slotDate || slotDate >= today) return null;
  const days = Math.round(
    (Date.parse(today) - Date.parse(slotDate)) / 86_400_000,
  );
  if (!Number.isFinite(days) || days < 1) return null;
  return intl.formatMessage(ageMessage, { days });
}
