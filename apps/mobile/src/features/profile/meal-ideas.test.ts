import { describe, expect, it } from "vitest";
import {
  changeMealIdeasOpening,
  mealIdeasDetail,
  changeMealIdeasDetail,
  mealSlotsFromMask,
  mealSlotsMask,
  readMealIdeasSelection,
} from "./meal-ideas";
import {
  mealIdeasBrief,
  mealIdeasChanges,
  mealIdeasForSlots,
  newDishesAnswer,
  newProfile,
  weekdays,
} from "@magpie/profile";

describe("a household's meal ideas brief", () => {
  it("combines existing guidance into one answer and lets clear remove it without changing the grid", () => {
    const scope = mealIdeasForSlots([{ day: "fri", meal: "dinner" }]);
    const value = `${scope}\nRice twice a week.`;
    const profile = {
      ...newProfile(),
      meal_ideas_brief: value,
      new_dishes: "rarely",
    };
    const combined = mealIdeasBrief(profile);
    expect(combined).toBe(
      `${value}\n\nWe like sticking to recipes we already make.`,
    );
    const changes = mealIdeasChanges(
      changeMealIdeasDetail(
        combined,
        "Mostly favourites. Enough for lunch tomorrow.",
      ),
    );
    expect(changes).toEqual({
      meal_ideas_brief: `${scope}\n\nMostly favourites. Enough for lunch tomorrow.`,
      new_dishes: null,
      day_habits: [],
    });
    expect(mealIdeasChanges(changeMealIdeasDetail(combined, ""))).toEqual({
      meal_ideas_brief: scope,
      new_dishes: null,
      day_habits: [],
    });
  });
  it("shows legacy favourites in summaries and consolidates them without duplication", () => {
    const profile = {
      ...newProfile(),
      new_dishes: "New recipes on Saturdays only.",
    };
    expect(mealIdeasBrief(profile)).toBe(profile.new_dishes);
    const edited = { ...profile, ...mealIdeasChanges(mealIdeasBrief(profile)) };
    expect(edited.new_dishes).toBeNull();
    expect(mealIdeasBrief(edited)).toBe(profile.new_dishes);
    expect(mealIdeasBrief({ ...edited, ...mealIdeasChanges("") })).toBe("");
  });
  it("keeps the generated meal scope out of the editable detail", () => {
    const opening = mealIdeasForSlots([{ day: "fri", meal: "dinner" }]);
    const value = `${opening}\n\nRice twice a week.`;
    expect(mealIdeasDetail(value)).toBe("Rice twice a week.");
    expect(changeMealIdeasDetail(value, "Enough for lunch tomorrow.")).toBe(
      `${opening}\n\nEnough for lunch tomorrow.`,
    );
    expect(changeMealIdeasDetail(value, "")).toBe(opening);
    expect(mealIdeasDetail("Rice twice a week.")).toBe("Rice twice a week.");
    expect(mealIdeasDetail(opening)).toBe("");
  });
  it("turns old favourites choices into editable answers without rewriting custom words", () => {
    expect(newDishesAnswer("rarely")).toBe(
      "We like sticking to recipes we already make.",
    );
    expect(newDishesAnswer("sometimes")).toBe(
      "Mostly our favourites, with about one new dish a week.",
    );
    expect(newDishesAnswer("often")).toBe(
      "We’d like lots of new recipes to try.",
    );
    expect(newDishesAnswer("New recipes on Saturdays only.")).toBe(
      "New recipes on Saturdays only.",
    );
    expect(newDishesAnswer(null)).toBe("");
  });
  it("keeps the picker’s lunch and dinner rows aligned Monday through Sunday", () => {
    const slots = [
      { day: "mon" as const, meal: "dinner" as const },
      { day: "sun" as const, meal: "lunch" as const },
    ];
    expect(mealSlotsMask(slots)).toBe((1 << 7) | (1 << 6));
    expect(mealSlotsFromMask(mealSlotsMask(slots))).toEqual([
      slots[1],
      slots[0],
    ]);
    expect(mealSlotsFromMask(0)).toEqual([]);
  });
  it("changes the chosen meals without losing what the household added", () => {
    const opening = "We’d like some ideas for dinner during the week.";
    const next = "We’d like some ideas for dinner every day.";
    expect(changeMealIdeasOpening("", null, opening)).toBe(opening);
    expect(
      changeMealIdeasOpening(
        `${opening}\nRice and stuff at least twice.`,
        opening,
        next,
      ),
    ).toBe(`${next}\nRice and stuff at least twice.`);
    expect(changeMealIdeasOpening("Leave Sunday to us.", opening, next)).toBe(
      `${next}\n\nLeave Sunday to us.`,
    );
    expect(
      changeMealIdeasOpening(
        `${opening}\nRice and stuff at least twice.`,
        opening,
        "",
      ),
    ).toBe("Rice and stuff at least twice.");
    expect(changeMealIdeasOpening("Rice twice a week.", null, "")).toBe(
      "Rice twice a week.",
    );
  });
  it("restores the visible grid from its saved sentence without guessing from custom writing", () => {
    const slots = [
      { day: "tue" as const, meal: "dinner" as const },
      { day: "sat" as const, meal: "lunch" as const },
    ];
    const opening = mealIdeasForSlots(slots);
    const restored = readMealIdeasSelection(`${opening}\nRice twice a week.`);
    expect(restored.opening).toBe(opening);
    expect(mealSlotsMask(restored.slots)).toBe(mealSlotsMask(slots));
    for (const mask of [0, 1, 127, 128, 16256, 16383]) {
      const value = mealIdeasForSlots(mealSlotsFromMask(mask));
      expect(mealSlotsMask(readMealIdeasSelection(value).slots)).toBe(mask);
    }
    expect(readMealIdeasSelection("Sunday is my cooking project.")).toEqual({
      opening: null,
      slots: [],
    });
  });
  it("starts without choosing meals for the household", () => {
    expect(mealIdeasBrief(newProfile())).toBe("");
    expect(mealIdeasForSlots([])).toBe("");
  });

  it("turns chosen meals into a complete starting sentence without adding habits", () => {
    expect(
      mealIdeasForSlots(
        weekdays.slice(0, 5).map((day) => ({ day, meal: "dinner" })),
      ),
    ).toBe("We’d like some ideas for dinner during the week.");
    expect(
      mealIdeasForSlots([
        { day: "sun", meal: "dinner" },
        { day: "sat", meal: "lunch" },
        { day: "sun", meal: "lunch" },
        { day: "sat", meal: "dinner" },
        { day: "sat", meal: "dinner" },
      ]),
    ).toBe("We’d like some ideas for lunch and dinner at the weekend.");
    expect(
      mealIdeasForSlots([
        { day: "tue", meal: "dinner" },
        { day: "sat", meal: "lunch" },
      ]),
    ).toBe(
      "We’d like some ideas for lunch on Saturdays, and dinner on Tuesdays.",
    );
  });

  it("brings old habits into the editable brief, including flexible meals and custom words", () => {
    const profile = newProfile();
    profile.meal_ideas_brief = "We’d like some ideas for dinner.";
    profile.day_habits = [
      { days: ["tue", "thu"], meal: "dinner" },
      { days: ["fri"], meal: "dinner", what: ["pizza"] },
      { per_week: 2, meal: "either", what: ["rice and stuff"] },
      { days: ["sun"], meal: "both", what: ["thai", "japanese"] },
    ];
    expect(mealIdeasBrief(profile)).toBe(
      "We’d like some ideas for dinner. We’d like some ideas for dinner on Tuesdays and Thursdays. On Fridays we’d like pizza for dinner. We’d like rice and stuff for lunch or dinner twice a week. On Sundays we’d like something Thai or Japanese for lunch and dinner.",
    );
    expect(profile.day_habits).toHaveLength(4);

    profile.meal_ideas_brief = "Sunday dinner is my cooking project.";
    expect(mealIdeasBrief(profile)).toContain(profile.meal_ideas_brief);
  });

  it("keeps the household's own writing verbatim, including an explicit empty answer", () => {
    const profile = newProfile();
    profile.meal_ideas_brief =
      "Weeknights only. Rice and stuff at least twice.\nBrotzeit works too.";
    expect(mealIdeasBrief(profile)).toBe(profile.meal_ideas_brief);
    profile.meal_ideas_brief = "";
    expect(mealIdeasBrief(profile)).toBe("");
  });
});
