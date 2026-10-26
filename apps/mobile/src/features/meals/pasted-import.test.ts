import { describe, expect, it } from "vitest";

import { pastedImport } from "./pasted-import";

describe("pastedImport", () => {
  it("imports a copied link as a link", () => {
    expect(
      pastedImport("  https://natashaskitchen.com/classic-risotto/\n"),
    ).toEqual({
      kind: "link",
      url: "https://natashaskitchen.com/classic-risotto/",
    });
  });

  it("reads anything else as the recipe text, even when a link is in it", () => {
    const caption = "Best risotto ever! 🍚 Recipe: https://example.com/risotto";
    expect(pastedImport(caption)).toEqual({ kind: "text", text: caption });
  });

  it("has nothing to import from an empty clipboard", () => {
    expect(pastedImport(" \n")).toBeNull();
  });
});
