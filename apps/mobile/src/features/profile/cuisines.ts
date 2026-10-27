import {
  cuisineOptions,
  ingredientGroup,
  ingredientId,
  isStapleGroup,
  keptExtras,
  keepsIngredient,
  type CookingProfile,
} from "@magpie/profile";

export type Cupboards = Pick<CookingProfile, "keeps" | "cuisines" | "extras">;
export type CupboardChange = (edit: (profile: Cupboards) => Cupboards) => void;

/** Cooking is its own fact: switching off forgets nothing they kept for it. */
export function setCooking(
  profile: Cupboards,
  cuisine: string,
  on: boolean,
): Cupboards {
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
  if (keepsIngredient(profile, id)) return removeIngredient(profile, id);
  return {
    ...profile,
    keeps: [...profile.keeps, id],
  };
}

function removeIngredient(profile: Cupboards, id: string): Cupboards {
  const extras = Object.fromEntries(
    Object.entries(profile.extras).flatMap(([group, labels]) => {
      const remaining = labels.filter(
        (label) => ingredientId(label, group) !== id,
      );
      return remaining.length ? [[group, remaining]] : [];
    }),
  );
  return {
    ...profile,
    keeps: profile.keeps.filter((key) => key !== id),
    extras,
  };
}

function setExtras(
  profile: Cupboards,
  cuisine: string,
  extras: string[],
): Cupboards {
  const { [cuisine]: _, ...rest } = profile.extras;
  return {
    ...profile,
    extras: extras.length ? { ...rest, [cuisine]: extras } : rest,
  };
}

export function addExtra(
  profile: Cupboards,
  cuisine: string,
  input: string,
): Cupboards {
  const typed = input.trim();
  const group = ingredientGroup(cuisine);
  if (!typed) return profile;
  const id = ingredientId(typed, group);
  if (id && cuisineOptions[group]?.ingredients.some((key) => key === id)) {
    return keepsIngredient(profile, id)
      ? profile
      : { ...profile, keeps: [...profile.keeps, id] };
  }
  if (
    keptExtras(profile, group).some(
      (extra) => extra.toLowerCase() === typed.toLowerCase(),
    )
  ) {
    return profile;
  }
  const next = setExtras(profile, group, [
    ...(profile.extras[group] ?? []),
    typed,
  ]);
  return id && !next.keeps.includes(id)
    ? { ...next, keeps: [...next.keeps, id] }
    : next;
}

export function removeExtra(
  profile: Cupboards,
  cuisine: string,
  label: string,
): Cupboards {
  const id = ingredientId(label, ingredientGroup(cuisine));
  if (id) return removeIngredient(profile, id);
  const extras = Object.fromEntries(
    Object.entries(profile.extras).flatMap(([group, labels]) => {
      const remaining =
        ingredientGroup(group) === ingredientGroup(cuisine)
          ? labels.filter(
              (extra) => extra.toLowerCase() !== label.toLowerCase(),
            )
          : labels;
      return remaining.length ? [[group, remaining]] : [];
    }),
  );
  return { ...profile, extras };
}

/** Cuisines of their own, kept listed while switched off if anything is written for them. */
export function ownCuisines(profile: Cupboards): string[] {
  const named = [...profile.cuisines, ...Object.keys(profile.extras)];
  return [...new Set(named)].filter(
    (cuisine) => !(cuisine in cuisineOptions) && !isStapleGroup(cuisine),
  );
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
