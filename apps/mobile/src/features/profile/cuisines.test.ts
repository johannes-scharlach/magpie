import { newProfile } from "@magpie/profile";
import { describe, expect, it } from "vitest";
import {
  addExtra,
  cookCuisine,
  cuisineId,
  medley,
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
  it("adds typed ingredients to the latest cupboard without blanks or duplicates", () => {
    const added = addExtra(profile, "japanese", "  Shiso  ");
    expect(added.cuisines[0]?.extras).toEqual(["Yuzu kosho", "Shiso"]);
    expect(addExtra(added, "japanese", "SHISO")).toBe(added);
    expect(addExtra(profile, "everyday", "  ")).toBe(profile);
    expect(addExtra(profile, "everyday", "Polenta").cuisines[1]).toEqual({
      cuisine: "everyday", extras: ["Polenta"],
    });
  });

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

  it("a cuisine's picture shows what they keep for it, and nothing for a cuisine they don't cook", () => {
    expect(medley(profile, "japanese")).toEqual(["miso", "sesame-oil"]);
    const stocked = { ...profile, keeps: ["sake", "nori", "mirin", "miso"] };
    expect(medley(stocked, "japanese")).toEqual(["miso", "mirin", "sake", "nori"]);
    expect(medley(profile, "thai")).toEqual([]);
    // Sesame oil is kept for Japanese; Korean lists it but they don't cook Korean.
    expect(medley(profile, "korean")).toEqual([]);
    expect(medley(profile, "Georgian")).toEqual([]);
  });

  it("removing a cuisine leaves what the household keeps", () => {
    expect(removeCuisine(profile, "japanese")).toEqual({
      keeps: profile.keeps,
      cuisines: [],
    });
  });
});
