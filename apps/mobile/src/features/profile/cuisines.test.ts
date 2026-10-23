import { newProfile } from "@magpie/profile";
import { describe, expect, it } from "vitest";
import {
  addExtra,
  cuisineId,
  ownCuisines,
  removeExtra,
  setCooking,
  toggleKept,
} from "./cuisines";

const profile = {
  ...newProfile(),
  keeps: ["sesame-oil", "miso"],
  cuisines: ["japanese"],
  extras: { japanese: ["Yuzu kosho"] },
};

describe("cuisine cupboards", () => {
  it("switching a cuisine off keeps what they wrote for it", () => {
    const off = setCooking(profile, "japanese", false);
    expect(off.cuisines).toEqual([]);
    expect(off.extras).toEqual(profile.extras);
    expect(setCooking(off, "japanese", true)).toEqual(profile);
    expect(setCooking(profile, "japanese", true)).toBe(profile);
  });

  it("adds typed ingredients without blanks or duplicates", () => {
    const added = addExtra(profile, "japanese", "  Shiso  ");
    expect(added.extras.japanese).toEqual(["Yuzu kosho", "Shiso"]);
    expect(addExtra(added, "japanese", "SHISO")).toBe(added);
    expect(addExtra(profile, "cupboard", "  ")).toBe(profile);
    expect(addExtra(profile, "cupboard", "Polenta").extras.cupboard).toEqual(["Polenta"]);
  });

  it("removing the last typed ingredient leaves no empty cuisine behind", () => {
    expect(removeExtra(profile, "japanese", "Yuzu kosho").extras).toEqual({});
  });

  it("a tick is one shared fact, whichever cuisine it was ticked under", () => {
    expect(toggleKept(profile, "gochujang").keeps).toEqual(["sesame-oil", "miso", "gochujang"]);
    expect(toggleKept(profile, "sesame-oil").keeps).toEqual(["miso"]);
  });

  it("their own cuisines stay listed while switched off, if they wrote something for them", () => {
    const own = {
      ...profile,
      cuisines: ["japanese", "Georgian"],
      extras: { ...profile.extras, Peranakan: ["Buah keluak"] },
    };
    expect(ownCuisines(own)).toEqual(["Georgian", "Peranakan"]);
    expect(ownCuisines(setCooking(own, "Georgian", false))).toEqual(["Peranakan"]);
  });

  it("a typed name finds the catalog cuisine or their own before adding one", () => {
    const withOwn = { ...profile, extras: { Georgian: ["Adjika"] } };
    expect(cuisineId(withOwn, " japanese ")).toBe("japanese");
    expect(cuisineId(withOwn, "georgian")).toBe("Georgian");
    expect(cuisineId(withOwn, "Peranakan")).toBe("Peranakan");
  });
});
