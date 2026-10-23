import { cuisineOptions, type CookingProfile } from "@magpie/profile";

export type Cupboards = Pick<CookingProfile, "keeps" | "cuisines" | "extras">;

/** Cooking is its own fact: switching off forgets nothing they kept for it. */
export function setCooking(profile: Cupboards, cuisine: string, on: boolean): Cupboards {
  if (profile.cuisines.includes(cuisine) === on) return profile;
  return {
    ...profile,
    cuisines: on
      ? [...profile.cuisines, cuisine]
      : profile.cuisines.filter((c) => c !== cuisine),
  };
}

/** A tick is one shared fact: it shows, and unticks, under every cuisine. */
export function toggleKept(profile: Cupboards, id: string): Cupboards {
  return {
    ...profile,
    keeps: profile.keeps.includes(id)
      ? profile.keeps.filter((k) => k !== id)
      : [...profile.keeps, id],
  };
}

function setExtras(profile: Cupboards, cuisine: string, extras: string[]): Cupboards {
  const { [cuisine]: _, ...rest } = profile.extras;
  return { ...profile, extras: extras.length ? { ...rest, [cuisine]: extras } : rest };
}

export function addExtra(profile: Cupboards, cuisine: string, input: string): Cupboards {
  const typed = input.trim();
  const extras = profile.extras[cuisine] ?? [];
  if (!typed || extras.some((extra) => extra.toLowerCase() === typed.toLowerCase())) {
    return profile;
  }
  return setExtras(profile, cuisine, [...extras, typed]);
}

export function removeExtra(profile: Cupboards, cuisine: string, label: string): Cupboards {
  return setExtras(
    profile,
    cuisine,
    (profile.extras[cuisine] ?? []).filter((extra) => extra !== label),
  );
}

/** Cuisines of their own, kept listed while switched off if anything is written for them. */
export function ownCuisines(profile: Cupboards): string[] {
  const named = [...profile.cuisines, ...Object.keys(profile.extras)];
  return [...new Set(named)].filter((cuisine) => !(cuisine in cuisineOptions));
}

/** A typed name matches a catalog label or one of their own before it becomes new. */
export function cuisineId(profile: Cupboards, name: string): string {
  const typed = name.trim();
  const same = (label: string) => label.toLowerCase() === typed.toLowerCase();
  return (
    Object.keys(cuisineOptions).find((id) => same(cuisineOptions[id]!.label)) ??
    ownCuisines(profile).find(same) ??
    typed
  );
}
