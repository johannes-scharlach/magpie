import { effortLabel } from "@magpie/meals";
import { cuisineLabel, equipmentOptions } from "@magpie/profile";

import type { Recipe, Variant } from "@/db/schema";

export type RecipeChoice = {
  /** The recipe's cuisine, shown with each variant (ADR 36). */
  cuisine: string | null;
  variant: Variant;
  olderVariant: boolean;
  variantCount: number;
};

/** Browse recipe groups; search picks the newest matching variant of each.
 *  A match on the recipe's cuisine or tags picks its newest variant.
 *  Variant matches include ingredient lines, equipment and effort. */
export function recipeChoices(
  recipes: Pick<Recipe, "id" | "created_at" | "cuisine" | "tags">[],
  variants: Variant[],
  search = "",
): RecipeChoice[] {
  const query = search.trim().toLocaleLowerCase();
  const groups = new Map<string, Variant[]>();
  for (const variant of variants) {
    if (!variant.recipe_id) continue;
    const group = groups.get(variant.recipe_id) ?? [];
    group.push(variant);
    groups.set(variant.recipe_id, group);
  }
  const recent = [...recipes].sort(
    (a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "") ||
      a.id.localeCompare(b.id),
  );
  return recent.flatMap((recipe) => {
    const alternatives = groups.get(recipe.id) ?? [];
    alternatives.sort(
      (a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? "") ||
        a.id.localeCompare(b.id),
    );
    const cuisine = recipe.cuisine ? cuisineLabel(recipe.cuisine) : null;
    const matches = (texts: (string | null | undefined)[]) =>
      texts.some((text) => text?.toLocaleLowerCase().includes(query));
    const recipeMatches = !query || matches([cuisine, recipe.tags]);
    const variant = alternatives.find((v) => {
      if (recipeMatches) return true;
      const equipment: string[] = JSON.parse(v.equipment ?? "[]");
      return matches([
        v.name,
        v.description,
        v.ingredient_lines,
        v.equipment,
        ...equipment.map(
          (id) => (equipmentOptions as Record<string, string>)[id] ?? id,
        ),
        v.effort,
        effortLabel(v.effort),
      ]);
    });
    return variant
      ? [
          {
            cuisine,
            variant,
            olderVariant: variant.id !== alternatives[0]?.id,
            variantCount: alternatives.length,
          },
        ]
      : [];
  });
}
