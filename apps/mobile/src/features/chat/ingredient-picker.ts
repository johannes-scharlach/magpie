import {
  freshOptions,
  ingredientLabel,
  pantryOptions,
  type CookingProfile,
} from "@magpie/profile";

import { ingredientNameKey } from "@/features/ingredients/ingredient-name";

export type PickedIngredient = {
  key: string;
  label: string;
};
type Picks = Pick<
  CookingProfile,
  "keeps" | "extras" | "pantry" | "fresh_ingredients"
>;
type Section = {
  id: "useUp" | "staples" | "cupboard" | "picked";
  tiles: PickedIngredient[];
};

const DEFAULT_STAPLES = [
  pantryOptions.rice,
  freshOptions.potatoes,
  pantryOptions.pasta,
];
const MEAL_BASES = new Set([
  ...DEFAULT_STAPLES.map(ingredientNameKey),
  "arborio-rice",
  "basmati-rice",
  "bomba-rice",
  "bulgur",
  "couscous",
  "egg-noodles",
  "jasmine-rice",
  "noodles",
  "orzo",
  "quinoa",
  "rice-noodles",
  "short-grain-rice",
  "soba",
  "udon",
  "wraps",
]);

export function ingredientPickerSections({
  useUp = [],
  profile,
  picked = [],
}: {
  useUp?: readonly string[];
  profile?: Picks;
  picked?: readonly PickedIngredient[];
}): Section[] {
  const kept = profile
    ? [
        ...Object.entries(pantryOptions).flatMap(([id, label]) =>
          profile.pantry[id] === true ? [label] : [],
        ),
        ...Object.entries(freshOptions).flatMap(([id, label]) =>
          profile.fresh_ingredients[id] === true ? [label] : [],
        ),
        ...profile.pantry.other,
        ...profile.fresh_ingredients.other,
        ...profile.keeps.map((id) =>
          id === "canned-corn"
            ? pantryOptions[id]
            : id.startsWith("frozen-")
              ? `Frozen ${ingredientLabel(id).toLowerCase()}`
              : ingredientLabel(id),
        ),
        ...Object.values(profile.extras).flat(),
      ]
    : [];
  const usualBases = kept.filter((label) =>
    MEAL_BASES.has(ingredientNameKey(label)),
  );
  const seen = new Set<string>();
  function take(labels: readonly string[], limit = Infinity) {
    const tiles: PickedIngredient[] = [];
    for (const label of labels) {
      const name = label.trim();
      const key = ingredientNameKey(name);
      if (!name || seen.has(key)) continue;
      seen.add(key);
      tiles.push({ key, label: name });
      if (tiles.length === limit) break;
    }
    return tiles;
  }

  const useUpTiles = take(useUp, 4);
  const staples = take([...usualBases, ...DEFAULT_STAPLES], 6);
  const cupboard = take(kept);
  const sections: Section[] = [
    { id: "useUp", tiles: useUpTiles },
    { id: "staples", tiles: staples },
    // Keep retired picks editable without a scroll through the whole cupboard.
    { id: "picked", tiles: picked.filter(({ key }) => !seen.has(key)) },
    { id: "cupboard", tiles: cupboard },
  ];
  return sections.filter(({ tiles }) => tiles.length > 0);
}

export function togglePickedIngredient(
  picked: readonly PickedIngredient[],
  tile: PickedIngredient,
): PickedIngredient[] {
  return picked.some(({ key }) => key === tile.key)
    ? picked.filter(({ key }) => key !== tile.key)
    : [...picked, tile];
}
