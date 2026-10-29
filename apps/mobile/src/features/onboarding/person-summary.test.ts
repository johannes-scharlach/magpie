import { newPerson } from "@magpie/profile";
import { describe, expect, it } from "vitest";
import { personSummary } from "./person-summary";

const person = newPerson("a17c9a92-784c-4dfe-b282-20bcfd877b11");

describe("person summary", () => {
  it("omits ordinary food, portion and attendance defaults, including older attendance labels", () => {
    for (const meal_times of ["All meals", "Always", "All planned meals"]) {
      expect(personSummary({ ...person, meal_times })).toBe("");
    }
  });

  it("keeps a person's food rule, different helping and attendance visible", () => {
    expect(
      personSummary({
        ...person,
        diet: "vegetarian",
        portion_reference: 0.75,
        meal_times: "Dinner only",
      }),
    ).toBe("Replace meat and fish · 0.75× helping · Dinner only");
  });

  it("keeps custom food rules and attendance in the person's own words", () => {
    expect(
      personSummary({
        ...person,
        diet: "other",
        diet_other: "Halal meat only.",
        meal_times: "Every other weekend",
      }),
    ).toBe("Halal meat only. · Every other weekend");
  });
});
