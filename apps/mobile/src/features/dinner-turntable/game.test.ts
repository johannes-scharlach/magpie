import { describe, expect, it } from "vitest";

import { cookDinnerMessage } from "@/features/chat/compose";

import { fits, newGame, play, type Dinner } from "./game";

const pasta: Dinner = {
  title: "Lemon pasta",
  name: "Lemon pasta",
  pitch: "Creamy lemon sauce coating pasta.",
  activeMinutes: 15,
  totalMinutes: 20,
  qualities: {
    temp: "Warming",
    weight: "Rich",
    texture: "Creamy",
    base: "Pasta",
    protein: "Veggie",
    flavor: "Zingy",
    cuisine: "Italian",
    veg: "No veg",
  },
};
const rice: Dinner = {
  ...pasta,
  title: "Creamy coconut rice",
  name: "Coconut rice",
  pitch: "Rice simmered in coconut milk.",
  qualities: { ...pasta.qualities, base: "Rice", cuisine: "Thai" },
};
const salad: Dinner = {
  ...pasta,
  title: "Crunchy chicken salad",
  name: "Chicken salad",
  qualities: {
    temp: "Refreshing",
    weight: "Light",
    texture: "Crunchy",
    base: "Veg",
    protein: "Chicken",
    flavor: "Savory",
    cuisine: "Greek",
    veg: "Raw",
  },
};
const dinners = [pasta, rice, salad];

describe("dinner turntable", () => {
  it("keeps creamy, rules out pasta, and changes the rest without losing either choice", () => {
    let game = newGame();
    game = play(dinners, game, { type: "mark", axis: "texture" });
    game = play(dinners, game, { type: "mark", axis: "base" });
    game = play(dinners, game, { type: "mark", axis: "base" });
    game = play(dinners, game, { type: "spin" });

    expect(dinners[game.current]?.title).toBe("Creamy coconut rice");
    expect(game.marks).toEqual({
      texture: { mode: "keep", value: "Creamy" },
      base: { mode: "avoid", value: "Pasta" },
    });
  });

  it("works with nothing pinned and visits unseen dinners before repeating", () => {
    const first = play(dinners, newGame(), { type: "spin" });
    expect(dinners[first.current]?.title).toBe("Crunchy chicken salad");

    const second = play(dinners, first, { type: "spin" });
    expect(dinners[second.current]?.title).toBe("Creamy coconut rice");
  });

  it("reports no other match rather than relaxing a pin, and a third tap releases it", () => {
    let game = play(dinners, newGame(), { type: "mark", axis: "base" });
    game = play(dinners, game, { type: "spin" });
    expect(game.current).toBe(0);
    expect(game.exhausted).toBe(true);
    expect(game.marks.base).toEqual({ mode: "keep", value: "Pasta" });

    game = play(dinners, game, { type: "mark", axis: "base" });
    game = play(dinners, game, { type: "mark", axis: "base" });
    expect(game.marks.base).toBeUndefined();
    expect(game.exhausted).toBe(false);
    expect(play(dinners, game, { type: "spin" }).current).toBe(2);
  });

  it("revisits an earlier dinner with its original choices, then can repeat an eligible dinner", () => {
    let game = play(dinners, newGame(), { type: "mark", axis: "texture" });
    game = play(dinners, game, { type: "spin" });
    game = play(dinners, game, { type: "mark", axis: "base" });
    game = play(dinners, game, { type: "revisit", current: 0 });

    expect(dinners[game.current]?.title).toBe("Lemon pasta");
    expect(game.marks).toEqual({ texture: { mode: "keep", value: "Creamy" } });
    expect(game.trail[0]).toEqual({
      current: 1,
      marks: {
        texture: { mode: "keep", value: "Creamy" },
        base: { mode: "keep", value: "Rice" },
      },
    });
    expect(play(dinners, game, { type: "spin" }).current).toBe(1);
  });

  it("hands the chosen dinner and explicit qualities to cooking, without inventing a time limit or asking for more twists", () => {
    expect(
      cookDinnerMessage(rice, {
        texture: { mode: "keep", value: "Creamy" },
        base: { mode: "avoid", value: "Pasta" },
      }),
    ).toBe(
      "Show me how to make: Creamy coconut rice.\n" +
        "Rice simmered in coconut milk.\n" +
        "Keep: Creamy (texture).\n" +
        "Rule out: Pasta (base).\n" +
        "Expand this meal rather than offering more ideas.",
    );
  });

  it("carries the seed's ingredient shortcuts into cooking as ingredients, not claims about stock", () => {
    expect(
      cookDinnerMessage(
        { ...rice, ingredients: "Quick-cook rice, coconut milk" },
        {},
      ),
    ).toContain("Ingredients: Quick-cook rice, coconut milk.");
  });

  it("cannot commit the current dinner after ruling out its base; the next match can be cooked", () => {
    let game = play(dinners, newGame(), { type: "mark", axis: "base" });
    game = play(dinners, game, { type: "mark", axis: "base" });
    expect(fits(dinners[game.current]!, game.marks)).toBe(false);

    game = play(dinners, game, { type: "spin" });
    expect(fits(dinners[game.current]!, game.marks)).toBe(true);
  });
});
