import { newProfile } from "@magpie/profile";
import { describe, expect, it } from "vitest";
import { kitchenPortrait } from "./kitchen-portrait";

describe("kitchen portrait", () => {
  it("names cuisines and pictures their specialties instead of the first cans", () => {
    const portrait = kitchenPortrait({
      ...newProfile(),
      keeps: ["canned-corn", "canned-tuna", "chickpeas", "doubanjiang", "sichuan-peppercorns", "polenta"],
      cuisines: [
        { cuisine: "everyday", extras: [] },
        { cuisine: "sichuan", extras: [] },
        { cuisine: "italian", extras: [] },
      ],
    });
    // The caption names three; the picture shows everything, staples last.
    expect(portrait?.artworkIds).toEqual([
      "ingredient-doubanjiang", "ingredient-polenta", "ingredient-sichuan-peppercorns",
      "ingredient-canned-corn", "ingredient-canned-tuna", "ingredient-chickpeas",
    ]);
    expect(portrait?.caption).toBe(
      "Sichuan and Italian cooking, with Doubanjiang, Polenta and Sichuan peppercorns.",
    );
  });

  it("includes their own cuisines and ingredients without inventing artwork", () => {
    const portrait = kitchenPortrait({
      ...newProfile(),
      cuisines: [{ cuisine: "Family favourites", extras: ["Nan’s chilli oil"] }],
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
      cuisines: [
        { cuisine: "japanese", extras: ["Miso"] },
        { cuisine: "cantonese", extras: [] },
      ],
    });
    expect(portrait?.caption).toBe("Japanese and Cantonese cooking, with Soy sauce and Miso.");
  });

  it("can celebrate an everyday cupboard without adding default equipment", () => {
    expect(kitchenPortrait({ ...newProfile(), keeps: ["chickpeas"] })).toEqual({
      artworkIds: ["ingredient-chickpeas"],
      caption: "A kitchen stocked with Chickpeas.",
    });
    expect(kitchenPortrait(newProfile())).toBeNull();
  });
});
