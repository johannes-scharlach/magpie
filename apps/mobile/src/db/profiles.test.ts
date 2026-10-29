import { describe, expect, it, vi } from "vitest";

import { decodeHousehold } from "./profiles";

vi.mock("./system", () => ({ powersync: {} }));

const person = {
  id: "d1bcc1ca-a825-49f4-8b5d-b8298edf90b5",
  list_id: "b2558bb3-6a9d-4f10-9835-8a6eff4906f7",
  user_id: "8b6fc415-9680-448f-996d-216d6922f71c",
  name: "Jo",
  age_group: "Adult",
  diet: "omnivore",
  diet_other: "",
  meal_times: "All meals",
  portion_reference: 1,
  created_at: "2026-09-15T07:30:05.677Z",
  updated_at: "2026-09-15T07:30:05.677Z",
};

const row = {
  id: "b2558bb3-6a9d-4f10-9835-8a6eff4906f7",
  goals: '{"other":[]}',
  kitchen_equipment: '{"other":[]}',
  pantry: '{"other":[]}',
  fresh_ingredients: '{"other":[]}',
  restrictions: "",
  meals_at_home: "Dinner",
  main_supermarket: "",
  other_shops: "",
  created_at: "2026-09-15T07:30:05.677Z",
  updated_at: "2026-09-15T07:30:05.677Z",
};

describe("decodeHousehold", () => {
  it("reads columns that arrived empty on an existing device", () => {
    // PowerSync adds new local columns as NULL to rows that already synced.
    const household = decodeHousehold(
      {
        ...row,
        ingredient_avoidances: null,
        shops: null,
        keeps: null,
        cuisines: null,
        extras: null,
        measurements: null,
      },
      [person],
    );
    expect(household.profile.ingredient_avoidances).toEqual([]);
    expect(household.profile.shops).toEqual([]);
    expect(household.profile.keeps).toEqual([]);
    expect(household.profile.cuisines).toEqual([]);
    expect(household.profile.extras).toEqual({});
    expect(household.profile.measurements).toEqual({
      system: "metric",
      temperature: "celsius",
      convert_imports: true,
    });
  });

  it("reads a person column that arrived empty on an existing device", () => {
    const household = decodeHousehold(row, [
      { ...person, portion_reference: null },
    ]);
    expect(household.people[0]!.portion_reference).toBe(1);
  });
});
