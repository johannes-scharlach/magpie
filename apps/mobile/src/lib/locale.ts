export const locales = ["en", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && locales.some((locale) => locale === value)
  );
}

/** "de-AT" and "de" both resolve to de; unsupported languages fall back. */
export function resolveLocale(languageTag: string | null | undefined): Locale {
  const language = languageTag?.toLowerCase().split(/[-_]/)[0];
  return isLocale(language) ? language : defaultLocale;
}
