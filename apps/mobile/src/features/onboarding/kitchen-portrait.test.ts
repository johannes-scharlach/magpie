import { newProfile } from "@magpie/profile";
import { describe, expect, it } from "vitest";
import { kitchenPortrait } from "./kitchen-portrait";

describe("kitchen portrait", () => {
  it("names cuisines and pictures their specialties instead of the first cans", () => {
    const portrait = kitchenPortrait({
      ...newProfile(),
      // Staples from every group: cupboard, fridge and freezer.
      keeps: ["canned-corn", "tofu", "doubanjiang", "sichuan-peppercorns", "polenta", "frozen-peas"],
      cuisines: ["sichuan", "italian"],
    });
    // The caption names three; the picture shows everything, staples last.
    expect(portrait?.artworkIds).toEqual([
      "ingredient-doubanjiang", "ingredient-polenta", "ingredient-sichuan-peppercorns",
      "ingredient-canned-corn", "ingredient-tofu", "ingredient-frozen-peas",
    ]);
    expect(portrait?.caption).toBe(
      "Sichuan and Italian cooking, with Doubanjiang, Polenta and Sichuan peppercorns.",
    );
  });

  it("includes their own cuisines and ingredients without inventing artwork", () => {
    const portrait = kitchenPortrait({
      ...newProfile(),
      cuisines: ["Family favourites"],
      // Thai is switched off, so what they wrote for it stays out of the picture.
      extras: { "Family favourites": ["Nan’s chilli oil"], thai: ["Fish sauce"] },
    });
    expect(portrait).toEqual({
      artworkIds: [],
      caption: "Family favourites cooking, with Nan’s chilli oil.",
    });
  });

  it("does not repeat a shared ingredient under different cuisines", () => {
    const portrait = kitchenPortrait({
      ...newProfile(),
      keeps: ["soy-sauce", "miso"],
      cuisines: ["japanese", "cantonese"],
      extras: { japanese: ["Miso"] },
    });
    expect(portrait?.caption).toBe("Japanese and Cantonese cooking, with Soy sauce and Miso.");
  });

  it("can celebrate a kitchen of staples without adding default equipment", () => {
    expect(kitchenPortrait({ ...newProfile(), keeps: ["chickpeas"] })).toEqual({
      artworkIds: ["ingredient-chickpeas"],
      caption: "A kitchen stocked with Chickpeas.",
    });
    expect(kitchenPortrait(newProfile())).toBeNull();
  });
});
