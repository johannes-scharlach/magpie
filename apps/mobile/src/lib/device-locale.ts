import { getLocales } from "expo-localization";

import { resolveLocale, type Locale } from "./locale";

/** The device's preferred language, limited to the app's supported locales. */
export function deviceLocale(): Locale {
  return resolveLocale(getLocales()[0]?.languageTag);
}
