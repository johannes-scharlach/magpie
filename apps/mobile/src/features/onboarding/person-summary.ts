import { dietRequests, type HouseholdPerson } from "@magpie/profile";

export function personSummary(person: HouseholdPerson): string {
  const details: string[] = [];
  if (person.diet !== "omnivore") {
    details.push(
      person.diet === "other" ? person.diet_other : dietRequests[person.diet],
    );
  }
  if (person.portion_reference !== 1) {
    details.push(`${person.portion_reference}× helping`);
  }
  if (
    !["All meals", "Always", "All planned meals"].includes(person.meal_times)
  ) {
    details.push(person.meal_times);
  }
  return details.join(" · ");
}
