const FRACTIONS: Record<string, string> = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
};

/** "1 1/3 bunch" reads as "1⅓ bunch", "3-4 tbsp" as "3–4 tbsp". */
export function prettyQuantity(text: string) {
  return text
    .replace(/(\d)\s*-\s*(\d)/g, "$1–$2")
    .replace(/(\d*)\s?\b([123])\/([234])\b/g, (match, whole, n, d) => {
      const glyph = FRACTIONS[`${n}/${d}`];
      return glyph ? `${whole}${glyph}` : match;
    });
}

/** Specs read "amount, note" ("3-4 tbsp, chopped"); a spec without a leading amount is all note. */
export function splitSpec(spec: string | null) {
  if (!spec) return { amount: null, note: null };
  const [first = "", ...rest] = spec.split(", ");
  return /^[\d½⅓⅔¼¾]/.test(first)
    ? { amount: prettyQuantity(first), note: rest.join(", ") || null }
    : { amount: null, note: spec };
}

/** Older meal ingredients can carry alternatives in the stored recipe name. */
export function splitShoppingName(name: string, fromMeal: boolean) {
  const match = fromMeal ? /^(.+?)(\s+(?:or|oder)\s+.+)$/iu.exec(name) : null;
  return match
    ? { primary: match[1]!, alternative: match[2]!.trim() }
    : { primary: name, alternative: null };
}
