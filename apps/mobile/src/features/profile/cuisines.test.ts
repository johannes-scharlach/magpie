import { newProfile } from "@magpie/profile";
import { describe, expect, it } from "vitest";
import {
  cookCuisine,
  cuisineId,
  removeCuisine,
  setExtras,
  toggleKept,
} from "./cuisines";

const profile = {
  ...newProfile(),
  keeps: ["sesame-oil", "miso"],
  cuisines: [{ cuisine: "japanese", extras: ["Yuzu kosho"] }],
};

describe("cuisine cupboards", () => {
  it("a tick is one shared fact, and ticking marks the cuisine as cooked", () => {
    const ticked = toggleKept(profile, "korean", "gochujang");
    expect(ticked.keeps).toEqual(["sesame-oil", "miso", "gochujang"]);
    expect(ticked.cuisines.map((c) => c.cuisine)).toEqual([
      "japanese",
      "korean",
    ]);
    // Unticking under Korean removes it everywhere, without adding Korean.
    const unticked = toggleKept(profile, "korean", "sesame-oil");
    expect(unticked.keeps).toEqual(["miso"]);
    expect(unticked.cuisines).toEqual(profile.cuisines);
  });

  it("own entries stay with their cuisine and mark it as cooked", () => {
    expect(setExtras(profile, "japanese", []).cuisines).toEqual([
      { cuisine: "japanese", extras: [] },
    ]);
    expect(setExtras(profile, "Georgian", ["Adjika"]).cuisines[1]).toEqual({
      cuisine: "Georgian",
      extras: ["Adjika"],
    });
  });

  it("cooking a cuisine needs nothing ticked, and never resets it", () => {
    expect(cookCuisine(profile, "italian").cuisines[1]).toEqual({
      cuisine: "italian",
      extras: [],
    });
    expect(cookCuisine(profile, "japanese")).toEqual(profile);
  });

  it("a typed name finds the catalog cuisine or their own before adding one", () => {
    const withOwn = cookCuisine(profile, "Georgian");
    expect(cuisineId(withOwn, " japanese ")).toBe("japanese");
    expect(cuisineId(withOwn, "georgian")).toBe("Georgian");
    expect(cuisineId(withOwn, "Peranakan")).toBe("Peranakan");
  });

  it("removing a cuisine leaves what the household keeps", () => {
    expect(removeCuisine(profile, "japanese")).toEqual({
      keeps: profile.keeps,
      cuisines: [],
    });
  });
});
