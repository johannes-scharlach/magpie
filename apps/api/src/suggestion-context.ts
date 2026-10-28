import {
  cuisinesContext,
  goalRulesContext,
  householdRulesContext,
  measurementContext,
  selectionLabels,
  shopRulesContext,
  staplesContext,
  type Household,
} from "@magpie/profile";

/** Follow-ups need the same decisions as the cook, including who each rule is for. */
export function suggestionContext(household: Household | null): string {
  if (!household) return "";
  const { profile, people } = household;
  const equipment = selectionLabels(
    "kitchen_equipment",
    profile.kitchen_equipment,
  );
  return [
    measurementContext(profile.measurements),
    `Available equipment: ${equipment.length ? equipment.join(", ") : "none declared"}`,
    goalRulesContext(profile),
    people.some((p) => p.age_group === "Child" || p.age_group === "Toddler")
      ? "Household: includes a child"
      : null,
    householdRulesContext(household),
    cuisinesContext(profile),
    staplesContext(profile),
    shopRulesContext(profile),
  ]
    .filter(Boolean)
    .join("\n\n");
}
