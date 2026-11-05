import { describe, expect, it, vi } from "vitest";

import { decodeHousehold, saveProfileSection } from "./profiles";
import { powersync } from "./system";
import { decodeForUpload } from "./upload-data";

vi.mock("./system", () => ({
  powersync: { execute: vi.fn().mockResolvedValue(undefined) },
}));

it("saves a cleared favourites answer as SQL null, keeping JSON fields encoded", async () => {
  await saveProfileSection("household", { new_dishes: null, day_habits: [] });
  const [sql, parameters] = vi.mocked(powersync.execute).mock.calls.at(-1)!;
  expect(sql).toContain("new_dishes = ?");
  expect(parameters!.slice(0, 2)).toEqual(["[]", null]);
  const upload = decodeForUpload("household_profiles", {
    day_habits: parameters![0],
    new_dishes: parameters![1],
  });
  expect(upload).toEqual({ day_habits: [], new_dishes: null });
  expect(
    decodeHousehold({ ...row, ...upload }, [person]).profile.new_dishes,
  ).toBeNull();
});

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
  meal_ideas_brief: "Weeknight dinners. Rice at least twice a week.",
  main_supermarket: "",
  other_shops: "",
  created_at: "2026-09-15T07:30:05.677Z",
  updated_at: "2026-09-15T07:30:05.677Z",
};

describe("decodeHousehold", () => {
  it("preserves the household's meal-ideas brief as ordinary text", () => {
    const household = decodeHousehold(row, [person]);
    expect(household.profile.meal_ideas_brief).toBe(row.meal_ideas_brief);
    expect(household.profile.meals_at_home).toBe("Dinner");
  });

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
        day_habits: null,
        new_dishes: null,
        meal_ideas_brief: null,
      },
      [person],
    );
    expect(household.profile.day_habits).toEqual([]);
    expect(household.profile.new_dishes).toBeNull();
    expect(household.profile.meal_ideas_brief).toBe("");
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
