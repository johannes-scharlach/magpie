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
  id: "useUp" | "fresh" | "staples" | "cupboard" | "picked";
  tiles: PickedIngredient[];
};

const DEFAULT_STAPLES = [
  pantryOptions.rice,
  freshOptions.potatoes,
  pantryOptions.pasta,
];
const PERISHABLE_KEEPS = new Set([
  "bacon",
  "cabbage",
  "cream",
  "dill",
  "greek-yoghurt",
  "lemongrass",
  "lemons",
  "limes",
  "plain-yoghurt",
  "sour-cream",
  "tofu",
]);
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
  query = "",
  displayLabel = (label) => label,
  freshFirst = false,
}: {
  useUp?: readonly string[];
  profile?: Picks;
  picked?: readonly PickedIngredient[];
  query?: string;
  displayLabel?: (label: string) => string;
  freshFirst?: boolean;
}): Section[] {
  const fresh = profile
    ? Object.entries(freshOptions).flatMap(([id, label]) =>
        profile.fresh_ingredients[id] === true ? [label] : [],
      )
    : [];
  const kept = profile
    ? [
        ...Object.entries(pantryOptions).flatMap(([id, label]) =>
          profile.pantry[id] === true ? [label] : [],
        ),
        ...fresh,
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
  const freshTiles = freshFirst
    ? take(
        [
          ...(profile?.fresh_ingredients.other ?? []),
          ...fresh,
          ...(profile?.keeps ?? [])
            .filter((id) => PERISHABLE_KEEPS.has(id))
            .map(ingredientLabel),
        ],
        3,
      )
    : [];
  const staples = take([...usualBases, ...DEFAULT_STAPLES], freshFirst ? 3 : 6);
  const cupboard = take(kept);
  const sections: Section[] = [
    { id: "useUp", tiles: useUpTiles },
    { id: "fresh", tiles: freshTiles },
    { id: "staples", tiles: staples },
    // Keep retired picks editable without a scroll through the whole cupboard.
    { id: "picked", tiles: picked.filter(({ key }) => !seen.has(key)) },
    { id: "cupboard", tiles: cupboard },
  ];
  const searchKey = searchText(query);
  return sections
    .map(({ id, tiles }) => ({
      id,
      tiles: searchKey
        ? tiles.filter(({ label }) =>
            [label, displayLabel(label)].some((name) =>
              searchText(name).includes(searchKey),
            ),
          )
        : tiles,
    }))
    .filter(({ tiles }) => tiles.length > 0);
}

type OnHandGroup = {
  id: "useUp" | "quickPicks" | "cupboard" | "matches";
  tiles: PickedIngredient[];
};

export function onHandPickerGroups(
  sections: Section[],
  query: string,
  displayLabel: (label: string) => string,
  locale: string,
): OnHandGroup[] {
  const available = sections.filter(({ id }) => id !== "picked");
  const sorted = (tiles: PickedIngredient[]) =>
    [...tiles].sort((a, b) =>
      displayLabel(a.label).localeCompare(displayLabel(b.label), locale),
    );
  const tilesFor = (id: Section["id"]) =>
    available.find((section) => section.id === id)?.tiles ?? [];
  const groups: OnHandGroup[] = query.trim()
    ? [
        {
          id: "matches",
          tiles: sorted(available.flatMap(({ tiles }) => tiles)),
        },
      ]
    : [
        { id: "useUp", tiles: tilesFor("useUp") },
        {
          id: "quickPicks",
          tiles: sorted([...tilesFor("fresh"), ...tilesFor("staples")]),
        },
        { id: "cupboard", tiles: sorted(tilesFor("cupboard")) },
      ];
  return groups.filter(({ tiles }) => tiles.length > 0);
}

function searchText(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

export function togglePickedIngredient(
  picked: readonly PickedIngredient[],
  tile: PickedIngredient,
): PickedIngredient[] {
  return picked.some(({ key }) => key === tile.key)
    ? picked.filter(({ key }) => key !== tile.key)
    : [...picked, tile];
}

export function addTypedIngredient(
  picked: readonly PickedIngredient[],
  text: string,
): PickedIngredient[] {
  const label = text.trim();
  const key = ingredientNameKey(label);
  return label && !picked.some((tile) => tile.key === key)
    ? [...picked, { key, label }]
    : [...picked];
}
