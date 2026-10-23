import {
  cooks,
  cuisineLabel,
  cuisineOptions,
  ingredientLabel,
  stapleGroups,
  type CookingProfile,
} from "@magpie/profile";

type Detail = { label: string; artworkId?: string };

function list(items: string[]) {
  if (items.length < 2) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Recognise the kitchen's character, independent of which artwork has arrived. */
export function kitchenPortrait(profile: CookingProfile) {
  const cuisines = profile.cuisines;
  const staples = new Set<string>(
    stapleGroups.flatMap((group) => cuisineOptions[group]?.ingredients ?? []),
  );
  const specialty = profile.keeps.filter((id) => !staples.has(id));
  const ingredient = (id: string): Detail => ({
    label: ingredientLabel(id),
    artworkId: `ingredient-${id}`,
  });
  const custom = (label: string): Detail => ({ label });
  const groups = cuisines.map((cuisine) => [
    ...specialty
      .filter((id) => cuisineOptions[cuisine]?.ingredients.some((kept) => kept === id))
      .map(ingredient),
    ...(profile.extras[cuisine] ?? []).map(custom),
  ]);
  const assigned = new Set(groups.flat().map((detail) => detail.label.toLowerCase()));
  groups.push([
    ...specialty.map(ingredient),
    ...Object.entries(profile.extras)
      .filter(([cuisine]) => cooks(profile, cuisine))
      .flatMap(([, extras]) => extras.map(custom)),
  ].filter((detail) => !assigned.has(detail.label.toLowerCase())));
  if (!groups.some((group) => group.length)) groups.push(profile.keeps.map(ingredient));

  const details: Detail[] = [];
  const seen = new Set<string>();
  // Take turns so one well-stocked cuisine doesn't crowd out the others.
  while (groups.some((group) => group.length)) {
    for (const group of groups) {
      const detail = group.shift();
      if (!detail || seen.has(detail.label.toLowerCase())) continue;
      seen.add(detail.label.toLowerCase());
      details.push(detail);
    }
  }
  // The picture holds the whole cupboard, staples behind the specialties.
  const pictured = [
    ...details,
    ...profile.keeps
      .filter((id) => staples.has(id))
      .map(ingredient)
      .filter((detail) => !seen.has(detail.label.toLowerCase())),
  ];
  if (!cuisines.length && !details.length) return null;

  const labels = cuisines.length > 3
    ? [...cuisines.slice(0, 2).map(cuisineLabel), `${cuisines.length - 2} other cuisines`]
    : cuisines.map(cuisineLabel);
  const flavours = list(details.slice(0, 3).map((detail) => detail.label));
  const caption = cuisines.length
    ? `${list(labels)} cooking${flavours ? `, with ${flavours}` : ""}.`
    : `A kitchen stocked with ${flavours}.`;
  return {
    artworkIds: pictured.flatMap((detail) => detail.artworkId ? [detail.artworkId] : []),
    caption,
  };
}
