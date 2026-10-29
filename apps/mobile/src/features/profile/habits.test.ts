import { describe, expect, it } from "vitest";

import { habitChoices, habitConsequence } from "./habits";

describe("day habit choices", () => {
  it("offers the household's own words first, most cooked first, then the starter list", () => {
    const choices = habitChoices(
      [
        { what: "pasta", recipes: 3 },
        { what: "italian", recipes: 5 },
      ],
      ["italian", "thai"],
    );
    expect(choices.slice(0, 3)).toEqual([
      { what: "italian", label: "Italian", recipes: 5 },
      { what: "pasta", label: "pasta", recipes: 3 },
      { what: "thai", label: "Thai" },
    ]);
    expect(choices.map((choice) => choice.what)).toContain("pizza");
    expect(
      choices.filter((choice) => choice.label.toLowerCase() === "pasta"),
    ).toHaveLength(1);
  });
});

describe("day habit wording", () => {
  it("says what Magpie will plan, and when", () => {
    expect(
      habitConsequence({ days: ["mon"], meal: "dinner", what: "pizza" }),
    ).toBe("Magpie plans pizza for dinner on Mon.");
    expect(
      habitConsequence({
        days: ["mon", "tue", "wed", "thu", "fri"],
        meal: "lunch",
        what: "italian",
      }),
    ).toBe("Magpie plans something Italian for lunch on weekdays.");
    expect(
      habitConsequence({ days: ["sun", "sat"], meal: "treat", what: "cake" }),
    ).toBe("Magpie plans cake for the treat at the weekend.");
  });
});
