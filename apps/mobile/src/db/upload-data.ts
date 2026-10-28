const JSON_COLUMNS: Record<string, readonly string[]> = {
  recipes: ["tags"],
  variants: ["ingredient_lines", "instructions", "sized_for", "equipment"],
  planned_meals: ["eater_ids", "ingredient_swaps", "ingredients_at_home"],
  household_profiles: [
    "goals",
    "kitchen_equipment",
    "measurements",
    "pantry",
    "fresh_ingredients",
    "ingredient_avoidances",
    "shops",
    "keeps",
    "cuisines",
    "extras",
  ],
};

/** SQLite stores JSON as text; Supabase must receive objects, not JSON strings. */
export function decodeForUpload(
  table: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...data };
  for (const column of JSON_COLUMNS[table] ?? []) {
    const value = out[column];
    if (typeof value !== "string") continue;
    try {
      out[column] = JSON.parse(value);
    } catch (cause) {
      const error = new Error(`Invalid JSON in ${column}`, { cause });
      // The connector recognises this as a non-retryable Postgres data error.
      throw Object.assign(error, { code: "22P02" });
    }
  }
  return out;
}
