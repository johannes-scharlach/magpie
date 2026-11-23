import { ingredientId } from "@magpie/profile";

import { bundledArtworkSource } from "@/features/onboarding/artwork";

import { ingredientNameKey } from "./ingredient-name";

/** Shared by ingredient surfaces. A miss means render the caller's label alone. */
export function bundledIngredientArt(label: string): number | undefined {
  const key = ingredientNameKey(label);
  const catalogId = ingredientId(label);
  return (
    bundledArtworkSource(`ingredient-${catalogId ?? key}`) ??
    bundledArtworkSource(`pantry-${key}`) ??
    bundledArtworkSource(`fresh-${key}`)
  );
}
