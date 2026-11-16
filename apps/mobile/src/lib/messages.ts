import type { IntlConfig } from "react-intl";

import de from "../../i18n/compiled/de.json";
import en from "../../i18n/compiled/en.json";
import type { Locale } from "./locale";

type Messages = NonNullable<IntlConfig["messages"]>;

const catalogs: Record<Locale, unknown> = { en, de };

/** Compiled catalogs are an import boundary; `formatjs compile` validates them. */
export function messagesFor(locale: Locale): Messages {
  return catalogs[locale] as Messages;
}
