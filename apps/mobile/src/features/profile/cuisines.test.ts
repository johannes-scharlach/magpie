import {
  cuisineLabel,
  keptLabels,
  keepsIngredient,
  newProfile,
  stapleGroups,
} from "@magpie/profile";
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
    expect(addExtra(profile, "cupboard", "Polenta").extras.cupboard).toEqual([
      "Polenta",
    ]);
  });

  it("removing the last typed ingredient leaves no empty cuisine behind", () => {
    expect(removeExtra(profile, "japanese", "Yuzu kosho").extras).toEqual({});
  });

  it("a tick is one shared fact, whichever cuisine it was ticked under", () => {
    expect(toggleKept(profile, "gochujang").keeps).toEqual([
      "sesame-oil",
      "miso",
      "gochujang",
    ]);
    expect(toggleKept(profile, "sesame-oil").keeps).toEqual(["miso"]);
  });

  it("their own cuisines stay listed while switched off, if they wrote something for them", () => {
    const own = {
      ...profile,
      cuisines: ["japanese", "Georgian"],
      extras: { ...profile.extras, Peranakan: ["Buah keluak"] },
    };
    expect(ownCuisines(own)).toEqual(["Georgian", "Peranakan"]);
    expect(ownCuisines(setCooking(own, "Georgian", false))).toEqual([
      "Peranakan",
    ]);
  });

  it("a typed name finds the catalog cuisine or their own before adding one", () => {
    const withOwn = { ...profile, extras: { Georgian: ["Adjika"] } };
    expect(cuisineId(withOwn, " japanese ")).toBe("japanese");
    expect(cuisineId(withOwn, "georgian")).toBe("Georgian");
    expect(cuisineId(withOwn, "Peranakan")).toBe("Peranakan");
  });

  it("carries a named staple into a cuisine without choosing the cuisine for them", () => {
    const added = addExtra(newProfile(), "fridge", "  Parmesan  ");
    expect(added.cuisines).toEqual([]);
    expect(added.keeps).toEqual(["parmesan"]);
    expect(added.extras).toEqual({ fridge: ["Parmesan"] });
    expect(keptLabels(added, "fridge")).toEqual(["Parmesan"]);
    expect(keptLabels(added, "italian")).toEqual([]);

    const italian = setCooking(added, "italian", true);
    expect(keepsIngredient(italian, "parmesan")).toBe(true);
    expect(keptLabels(italian, "italian")).toEqual(["Parmesan"]);
    const removed = removeExtra(italian, "fridge", "Parmesan");
    expect(removed.keeps).toEqual([]);
    expect(removed.extras).toEqual({});
    expect(keptLabels(removed, "italian")).toEqual([]);
    expect(removed.cuisines).toEqual(["italian"]);
  });

  it("recognises earlier typed ingredients and unticks the same fact everywhere", () => {
    const earlier = {
      ...newProfile(),
      cuisines: ["italian"],
      extras: { fridge: ["pArMeSaN", "Farmhouse curd"], italian: ["Parmesan"] },
    };
    expect(keepsIngredient(earlier, "parmesan")).toBe(true);
    expect(keptLabels(earlier, "italian")).toEqual(["Parmesan"]);
    const removed = toggleKept(earlier, "parmesan");
    expect(removed.extras).toEqual({ fridge: ["Farmhouse curd"] });
    expect(keepsIngredient(removed, "parmesan")).toBe(false);
    expect(keptLabels(removed, "italian")).toEqual([]);
    expect(earlier.extras.fridge).toEqual(["pArMeSaN", "Farmhouse curd"]);
    // Typing something already offered by this cuisine ticks its tile, not a duplicate chip.
    const typed = addExtra(newProfile(), "italian", "Parmesan");
    expect(typed.keeps).toEqual(["parmesan"]);
    expect(typed.extras).toEqual({});
  });

  it("combines tins and jars into Cupboard without losing earlier custom ingredients", () => {
    const earlier = {
      ...newProfile(),
      keeps: ["canned-tomatoes"],
      extras: {
        cupboard: ["Polenta"],
        "tins-and-jars": ["Borlotti beans"],
      },
    };
    expect(stapleGroups.map(cuisineLabel)).toEqual([
      "Cupboard",
      "Fridge",
      "Freezer",
    ]);
    expect(keptLabels(earlier, "cupboard")).toEqual([
      "Canned tomatoes",
      "Polenta",
      "Borlotti beans",
    ]);
    expect(ownCuisines(earlier)).toEqual([]);
    expect(removeExtra(earlier, "cupboard", "Borlotti beans").extras).toEqual({
      cupboard: ["Polenta"],
    });
  });

  it("does not mistake a generic ingredient name for its frozen form", () => {
    const fridge = addExtra(newProfile(), "fridge", "Peas");
    expect(fridge.keeps).toEqual([]);
    expect(fridge.extras).toEqual({ fridge: ["Peas"] });
    const freezer = addExtra(newProfile(), "freezer", "Peas");
    expect(freezer.keeps).toEqual(["frozen-peas"]);
    expect(freezer.extras).toEqual({});
  });
});
