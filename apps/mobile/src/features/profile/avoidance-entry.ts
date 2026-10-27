import {
  avoidanceKinds,
  avoidanceSchema,
  tracePolicies,
  type HouseholdPerson,
  type IngredientAvoidance,
} from "@magpie/profile";

export function saveAvoidanceEntry(
  entries: IngredientAvoidance[],
  index: number | null,
  value: Partial<IngredientAvoidance>,
): IngredientAvoidance[] {
  const item = avoidanceSchema.parse({
    ...value,
    detail: value.detail?.trim(),
  });
  if (item.kind !== "allergy") delete item.trace_policy;
  if (index === null) return [...entries, item];
  if (!Number.isInteger(index) || !entries[index])
    throw new Error("This entry is no longer in your list.");
  return entries.map((entry, row) => (row === index ? item : entry));
}

export function avoidanceSummary(
  item: IngredientAvoidance,
  people: Pick<HouseholdPerson, "id" | "name">[],
): string {
  const scope = item.person_ids
    ? item.person_ids.length
      ? item.person_ids
          .map(
            (id) =>
              people.find((p) => p.id === id)?.name ||
              "Person no longer listed",
          )
          .join(", ")
      : "Everyone"
    : null;
  return [
    avoidanceKinds[item.kind],
    scope,
    item.kind === "allergy" && item.trace_policy
      ? tracePolicies[item.trace_policy]
      : null,
    item.detail,
  ]
    .filter(Boolean)
    .join(" · ");
}
