const aliases = new Map([
  ["basmati", "basmati-rice"],
  ["canned-sweetcorn", "canned-corn"],
  ["canned-tuna-fish", "canned-tuna"],
  ["garbanzo-beans", "chickpeas"],
  ["greek-yogurt", "greek-yoghurt"],
  ["kartoffel", "potatoes"],
  ["kartoffeln", "potatoes"],
  ["lemon", "lemons"],
  ["lime", "limes"],
  ["onion", "onions"],
  ["plain-yogurt", "plain-yoghurt"],
  ["potato", "potatoes"],
  ["reis", "rice"],
  ["tinned-tomatoes", "canned-tomatoes"],
  ["tinned-tuna", "canned-tuna"],
  ["zitronen", "lemons"],
]);

/** Match known equivalents without conflating different preparations. */
export function ingredientNameKey(label: string): string {
  const key = label
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
  return aliases.get(key) ?? (key || label.trim().toLowerCase());
}
