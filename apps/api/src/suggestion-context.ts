import {
  dietOptions,
  selectionLabels,
  type Household,
  type IngredientAvoidance,
} from "@magpie/profile";

function avoidanceLabel({ ingredient, kind, detail }: IngredientAvoidance): string {
  const notes = [kind === "allergy" ? "allergy" : "", detail.trim()].filter(
    Boolean,
  );
  return notes.length ? `${ingredient} (${notes.join("; ")})` : ingredient;
}

/** Only the household facts that can help steer a follow-up, not the full chat context. */
export function suggestionContext(household: Household | null): string {
  if (!household) return "";
  const { profile, people } = household;
  const equipment = selectionLabels(
    "kitchen_equipment",
    profile.kitchen_equipment,
  );
  const goals = selectionLabels("goals", profile.goals);
  const diets = [
    ...new Set(
      people
        .map((person) => {
          if (person.diet === "omnivore") return "";
          if (person.diet === "other") return person.diet_other.trim();
          if (person.diet === "flexitarian")
            return "Flexitarian (plant-forward, includes meat and fish)";
          return dietOptions[person.diet];
        })
        .filter(Boolean),
    ),
  ];
  const mustAvoid = profile.ingredient_avoidances
    .filter((a) => a.kind !== "dislike")
    .map(avoidanceLabel);
  const dislikes = profile.ingredient_avoidances
    .filter((a) => a.kind === "dislike")
    .map(avoidanceLabel);

  return [
    `Available equipment: ${equipment.length ? equipment.join(", ") : "none declared"}`,
    goals.length ? `Cooking goals: ${goals.join("; ")}` : null,
    people.some((p) => p.age_group === "Child" || p.age_group === "Toddler")
      ? "Household: includes a child"
      : null,
    diets.length ? `Household diets: ${diets.join("; ")}` : null,
    mustAvoid.length ? `Must avoid: ${mustAvoid.join("; ")}` : null,
    dislikes.length ? `Dislikes: ${dislikes.join("; ")}` : null,
    profile.restrictions.trim()
      ? `Other food restrictions: ${profile.restrictions.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}
