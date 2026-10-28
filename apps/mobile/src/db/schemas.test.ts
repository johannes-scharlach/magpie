import { describe, expect, it } from "vitest";

import { ImportReviewSchema, InstructionSchema } from "./schemas";

describe("InstructionSchema", () => {
  it("keeps each step's own share of an ingredient", () => {
    const step = InstructionSchema.parse({
      name: "Glaze",
      ingredients: [
        { qty_text: "75g", item_name: "butter", prep_note: "melted" },
      ],
      text: "Brush over the warm cake.",
    });
    expect(step.ingredients).toEqual([
      { qty_text: "75g", item_name: "butter", prep_note: "melted" },
    ]);
  });

  it("still reads steps saved as plain strings", () => {
    const step = InstructionSchema.parse({
      name: "Simmer",
      ingredients: ["2 cans chickpeas, drained"],
      text: "Simmer until tender.",
    });
    expect(step.ingredients).toEqual(["2 cans chickpeas, drained"]);
  });
});

describe("ImportReviewSchema", () => {
  it("keeps source references from synced review JSON for both recipe lists", () => {
    const review = {
      listId: "household",
      recipes: [{ name: "Miso beans", sourceReference: "Pages 36–37" }],
      skipped: [
        {
          name: "Aubergine pasta",
          reason: "The steps are cut off.",
          sourceReference: "Photo 3",
        },
      ],
    };
    expect(
      ImportReviewSchema.parse(JSON.parse(JSON.stringify(review))),
    ).toEqual(review);
  });

  it("still reads older reviews and text with no page reference", () => {
    const review = {
      listId: "household",
      recipes: [{ name: "Miso beans" }],
      skipped: [{ name: "Aubergine pasta", reason: "The steps are cut off." }],
    };
    expect(ImportReviewSchema.parse(review)).toEqual(review);

    const unpaged = {
      ...review,
      recipes: [{ ...review.recipes[0], sourceReference: null }],
      skipped: [{ ...review.skipped[0], sourceReference: null }],
    };
    expect(ImportReviewSchema.parse(unpaged)).toEqual(unpaged);
  });
});
