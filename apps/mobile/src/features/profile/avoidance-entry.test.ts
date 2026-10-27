import { describe, expect, it } from "vitest";
import { type IngredientAvoidance } from "@magpie/profile";
import { saveAvoidanceEntry, avoidanceSummary } from "./avoidance-entry";

const sam = "9c5b42f7-fbea-4df2-b8d3-d42d37ed9a1d";
describe("food boundaries", () => {
  it("saves scope and exceptions without merging different people's rules", () => {
    const existing: IngredientAvoidance = {
      ingredient: "Soy",
      kind: "allergy",
      detail: "Only Lee",
    };
    const item: IngredientAvoidance = {
      ingredient: " Soy ",
      kind: "allergy",
      person_ids: [sam],
      trace_policy: "may-contain-okay",
      detail: " No tofu; soy sauce okay ",
    };
    const saved = saveAvoidanceEntry([existing], null, item);
    expect(saved).toEqual([
      existing,
      { ...item, ingredient: "Soy", detail: "No tofu; soy sauce okay" },
    ]);
    expect(avoidanceSummary(saved[1]!, [{ id: sam, name: "Sam" }])).toBe(
      "Allergy · Sam · “May contain” labels are okay · No tofu; soy sauce okay",
    );
  });
  it("requires a reason and ingredient, and drops trace handling when the reason changes", () => {
    expect(() =>
      saveAvoidanceEntry([], null, { ingredient: "Soy", detail: "" }),
    ).toThrow();
    expect(() =>
      saveAvoidanceEntry([], null, {
        ingredient: " ",
        kind: "dislike",
        detail: "",
      }),
    ).toThrow();
    const original: IngredientAvoidance = {
      ingredient: "Soy",
      kind: "allergy",
      detail: "",
      trace_policy: "avoid",
    };
    expect(
      saveAvoidanceEntry([original], 0, { ...original, kind: "dislike" }),
    ).toEqual([{ ingredient: "Soy", kind: "dislike", detail: "" }]);
    expect(original.trace_policy).toBe("avoid");
  });
  it("does not invent who old notes are for or hide a removed person's boundary", () => {
    expect(
      avoidanceSummary(
        { ingredient: "Milk", kind: "restriction", detail: "Only Sam" },
        [],
      ),
    ).toBe("Must avoid · Only Sam");
    expect(
      avoidanceSummary(
        { ingredient: "Soy", kind: "allergy", detail: "", person_ids: [sam] },
        [],
      ),
    ).toBe("Allergy · Person no longer listed");
  });
});
