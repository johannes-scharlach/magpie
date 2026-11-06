import { describe, expect, it } from "vitest";

import { cookDinnerMessage } from "@/features/chat/compose";

import {
  keptMarks,
  newGame,
  play,
  reel,
  type Dinner,
  type Qualities,
} from "./game";

const lemonPasta: Qualities = {
  temp: "Warming",
  weight: "Rich",
  texture: "Creamy",
  base: "Pasta",
  protein: "Veggie",
  flavor: "Zingy",
  cuisine: "Italian",
  veg: "No veg",
};

/** A dinner that differs from lemon pasta only where it says. */
function meal(
  name: string,
  family: string,
  changes: Partial<Qualities> = {},
): Dinner {
  return {
    title: name,
    name,
    family,
    pitch: `${name}.`,
    activeMinutes: 15,
    totalMinutes: 20,
    qualities: { ...lemonPasta, ...changes },
  };
}

function names(dinners: readonly Dinner[]) {
  return (index: number) => dinners[index]!.name;
}

describe("scrolling a reel to a value", () => {
  const dinners = [
    meal("Lemon pasta", "lemon"),
    meal("Spiced Thai rice", "spiced", {
      base: "Rice",
      cuisine: "Thai",
      flavor: "Spiced",
    }),
    meal("Thai rice", "thai", { base: "Rice", cuisine: "Thai" }),
    meal("Herb rice", "lemon", { base: "Rice", flavor: "Herby" }),
    meal("Thai noodles", "noodles", { base: "Noodles", cuisine: "Thai" }),
  ];
  const name = names(dinners);

  it("lands on the closest dinner with that value; the same picture wins a tie, then list order", () => {
    const start = newGame(dinners, 0);

    const rice = play(dinners, start, {
      type: "set",
      axis: "base",
      value: "Rice",
    });
    expect(name(rice.current)).toBe("Herb rice");

    const thai = play(dinners, start, {
      type: "set",
      axis: "cuisine",
      value: "Thai",
    });
    expect(name(thai.current)).toBe("Thai rice");
  });

  it("changes nothing for the value already showing, or a value no dinner can reach", () => {
    const start = newGame(dinners, 0);
    expect(
      play(dinners, start, { type: "set", axis: "base", value: "Pasta" }),
    ).toBe(start);
    expect(
      play(dinners, start, { type: "set", axis: "base", value: "Potato" }),
    ).toBe(start);
  });
});

describe("a set value", () => {
  const dinners = [
    meal("Lemon pasta", "lemon"),
    meal("Herb pasta", "herb", { flavor: "Herby", cuisine: "Thai" }),
    meal("Herb rice", "herb-rice", { base: "Rice", flavor: "Herby" }),
    meal("Thai salad rice", "thai", {
      base: "Rice",
      cuisine: "Thai",
      flavor: "Spiced",
      veg: "Raw",
    }),
  ];
  const name = names(dinners);

  it("holds for the rest of the game, even when a closer dinner would drop it", () => {
    let game = newGame(dinners, 0);
    game = play(dinners, game, { type: "set", axis: "base", value: "Rice" });
    game = play(dinners, game, { type: "set", axis: "cuisine", value: "Thai" });

    expect(name(game.current)).toBe("Thai salad rice");
    expect(game.choices).toEqual({ base: "Rice", cuisine: "Thai" });
    expect(
      play(dinners, game, { type: "set", axis: "base", value: "Pasta" }),
    ).toBe(game);
  });

  it("leaves the reels", () => {
    const game = play(dinners, newGame(dinners, 0), {
      type: "set",
      axis: "base",
      value: "Rice",
    });
    expect(game.reels).not.toContain("base");
  });
});

describe("a reel", () => {
  it("shows only reachable values, gentlest next to the current one, alternating sides as changes grow", () => {
    const dinners = [
      meal("Saucy pasta", "lemon", { texture: "Saucy" }),
      meal("Lemon pasta", "lemon"),
      meal("Lemon rice", "rice", { base: "Rice" }),
      meal("Herb noodles", "noodles", { base: "Noodles", flavor: "Herby" }),
      meal("Herb toast", "lemon", { base: "Bread", flavor: "Herby" }),
      meal("Greek potato salad", "potato", {
        base: "Potato",
        cuisine: "Greek",
        veg: "Raw",
      }),
      meal("Saucy beans", "beans", { base: "Beans", texture: "Saucy" }),
    ];
    const game = play(dinners, newGame(dinners, 0), {
      type: "set",
      axis: "texture",
      value: "Creamy",
    });
    expect(dinners[game.current]!.name).toBe("Lemon pasta");

    // Beans would undo the creamy choice, so they don't show.
    expect(reel(dinners, game, "base")).toEqual([
      "Potato",
      "Bread",
      "Pasta",
      "Rice",
      "Noodles",
    ]);
  });
});

describe("the reels that show", () => {
  it("are the three whose gentlest change moves the fewest other qualities, then the smallest average change", () => {
    const dinners = [
      meal("Lemon pasta", "lemon"),
      meal("Lemon rice", "rice", { base: "Rice" }),
      meal("Thai lemon pasta", "thai", { cuisine: "Thai" }),
      meal("Herb salad pasta", "herb", { flavor: "Herby", veg: "Raw" }),
      meal("Silky spiced tofu", "tofu", {
        flavor: "Spiced",
        protein: "Tofu",
        texture: "Silky",
      }),
      meal("Cold noodle bowl", "noodles", {
        base: "Noodles",
        weight: "Hearty",
        temp: "Refreshing",
      }),
    ];
    expect(newGame(dinners, 0).reels).toEqual(["cuisine", "base", "veg"]);
  });

  it("keep their slot while still among the top four, so they don't reshuffle on every move", () => {
    const thai = { cuisine: "Thai" };
    const raw = { ...thai, veg: "Raw" };
    const dinners = [
      meal("Thai pasta", "a", thai),
      meal("Cold Thai pasta", "b", { ...thai, temp: "Refreshing" }),
      meal("Thai fish pasta", "c", { ...thai, protein: "Fish" }),
      meal("Thai salad pasta", "d", raw),
      meal("Crispy salad pasta", "e", { ...raw, texture: "Crispy" }),
      meal("Salad rice", "f", { ...raw, base: "Rice" }),
      meal("Cold salad noodles", "g", {
        ...raw,
        base: "Noodles",
        temp: "Refreshing",
        weight: "Light",
      }),
      meal("Cold light salad", "h", {
        ...raw,
        temp: "Refreshing",
        weight: "Light",
      }),
      meal("Cold fish salad", "i", {
        ...raw,
        protein: "Fish",
        temp: "Refreshing",
        weight: "Light",
      }),
    ];
    const start = newGame(dinners, 0);
    expect(start.reels).toEqual(["temp", "protein", "veg"]);

    // Now texture, base, temp, weight, protein rank in that order.
    const salad = play(dinners, start, {
      type: "set",
      axis: "veg",
      value: "Raw",
    });
    expect(dinners[salad.current]!.name).toBe("Thai salad pasta");
    expect(salad.reels).toEqual(["temp", "texture", "base"]);
  });
});

describe("a game", () => {
  const dinners = [
    meal("Lemon pasta", "lemon"),
    meal("Lemon rice", "rice", { base: "Rice" }),
    meal("Thai lemon rice", "thai", { base: "Rice", cuisine: "Thai" }),
  ];

  it("goes back one change at a time: dinner, choice and reels", () => {
    const start = newGame(dinners, 0);
    const rice = play(dinners, start, {
      type: "set",
      axis: "base",
      value: "Rice",
    });
    const thai = play(dinners, rice, {
      type: "set",
      axis: "cuisine",
      value: "Thai",
    });

    expect(play(dinners, thai, { type: "back" })).toEqual(rice);
    expect(
      play(dinners, play(dinners, thai, { type: "back" }), { type: "back" }),
    ).toEqual(start);
    expect(play(dinners, start, { type: "back" })).toBe(start);
  });

  it("ends when no reel can move, and Back still works from there", () => {
    let game = newGame(dinners, 0);
    game = play(dinners, game, { type: "set", axis: "base", value: "Rice" });
    game = play(dinners, game, { type: "set", axis: "cuisine", value: "Thai" });
    expect(game.reels).toEqual([]);
    expect(play(dinners, game, { type: "back" }).reels).not.toEqual([]);
  });

  it("starts over on a spin, at any time", () => {
    const rice = play(dinners, newGame(dinners, 0), {
      type: "set",
      axis: "base",
      value: "Rice",
    });
    expect(play(dinners, rice, { type: "spin", current: 2 })).toEqual(
      newGame(dinners, 2),
    );
  });
});

describe("cooking", () => {
  const rice = meal("Creamy coconut rice", "rice", {
    base: "Rice",
    cuisine: "Thai",
  });

  it("hands the dinner and the values the cook set to the chat as kept", () => {
    expect(
      cookDinnerMessage(
        rice,
        keptMarks({ cuisine: "Thai", texture: "Creamy" }),
      ),
    ).toContain("Keep: Creamy (texture), Thai (cuisine).");
    expect(cookDinnerMessage(rice, keptMarks({}))).not.toContain("Keep");
  });
});
