import { cuisineOptions, type CookingProfile } from "@magpie/profile";

type Cupboards = Pick<CookingProfile, "keeps" | "cuisines">;

/** Every change saves at once; anything added to a cuisine means they cook it. */
export function cookCuisine(profile: Cupboards, cuisine: string): Cupboards {
  if (profile.cuisines.some((c) => c.cuisine === cuisine)) return profile;
  return {
    ...profile,
    cuisines: [...profile.cuisines, { cuisine, extras: [] }],
  };
}

/** A tick is one shared fact: it shows, and unticks, under every cuisine. */
export function toggleKept(
  profile: Cupboards,
  cuisine: string,
  id: string,
): Cupboards {
  if (profile.keeps.includes(id)) {
    return { ...profile, keeps: profile.keeps.filter((k) => k !== id) };
  }
  return cookCuisine({ ...profile, keeps: [...profile.keeps, id] }, cuisine);
}

export function setExtras(
  profile: Cupboards,
  cuisine: string,
  extras: string[],
): Cupboards {
  const cooked = cookCuisine(profile, cuisine);
  return {
    ...cooked,
    cuisines: cooked.cuisines.map((c) =>
      c.cuisine === cuisine ? { cuisine, extras } : c,
    ),
  };
}

export function addExtra(profile: Cupboards, cuisine: string, input: string): Cupboards {
  const typed = input.trim();
  const extras = profile.cuisines.find((c) => c.cuisine === cuisine)?.extras ?? [];
  if (!typed || extras.some((extra) => extra.toLowerCase() === typed.toLowerCase())) {
    return profile;
  }
  return setExtras(profile, cuisine, [...extras, typed]);
}

export function removeCuisine(profile: Cupboards, cuisine: string): Cupboards {
  return {
    keeps: profile.keeps,
    cuisines: profile.cuisines.filter((c) => c.cuisine !== cuisine),
  };
}

/** A typed name matches a catalog label or one of their own before it becomes new. */
export function cuisineId(profile: Cupboards, name: string): string {
  const typed = name.trim();
  const same = (label: string) => label.toLowerCase() === typed.toLowerCase();
  return (
    Object.keys(cuisineOptions).find((id) => same(cuisineOptions[id]!.label)) ??
    profile.cuisines.find((c) => same(c.cuisine))?.cuisine ??
    typed
  );
}
