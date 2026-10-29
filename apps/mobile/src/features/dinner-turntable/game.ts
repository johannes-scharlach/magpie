export const axes = [
  { id: "temp", name: "Temperature" },
  { id: "weight", name: "Weight" },
  { id: "texture", name: "Texture" },
  { id: "base", name: "Base" },
  { id: "protein", name: "Protein" },
  { id: "flavor", name: "Flavor" },
  { id: "cuisine", name: "Cuisine" },
  { id: "fam", name: "Familiarity" },
] as const;

export type Axis = (typeof axes)[number]["id"];
export type Qualities = Record<Axis, string>;
export type Marks = Partial<
  Record<Axis, { mode: "keep" | "avoid"; value: string }>
>;

export type Dinner = {
  title: string;
  name: string;
  pitch: string;
  ingredients?: string;
  activeMinutes: number;
  totalMinutes: number;
  qualities: Qualities;
};

export type Game = {
  current: number;
  marks: Marks;
  seen: number[];
  exhausted: boolean;
  trail: { current: number; marks: Marks }[];
};

export type Action =
  | { type: "mark"; axis: Axis }
  | { type: "spin" }
  | { type: "revisit"; current: number };

export function newGame(current = 0): Game {
  return { current, marks: {}, seen: [current], exhausted: false, trail: [] };
}

function trailTo(game: Game, next: number): Game["trail"] {
  return [
    { current: game.current, marks: game.marks },
    ...game.trail.filter((earlier) => earlier.current !== next),
  ].slice(0, 3);
}

export function fits(dinner: Dinner, marks: Marks): boolean {
  return axes.every(({ id }) => {
    const mark = marks[id];
    if (!mark) return true;
    const matches = dinner.qualities[id] === mark.value;
    return mark.mode === "keep" ? matches : !matches;
  });
}

/** A spin changes the open qualities, never the cook's explicit choices. */
export function play(
  dinners: readonly Dinner[],
  game: Game,
  action: Action,
): Game {
  const current = dinners[game.current];
  if (!current) return game;

  if (action.type === "revisit") {
    const earlier = game.trail.find(
      (entry) => entry.current === action.current,
    );
    if (!earlier) return game;
    return {
      ...game,
      ...earlier,
      exhausted: false,
      trail: trailTo(game, earlier.current),
    };
  }

  if (action.type === "mark") {
    const marks = { ...game.marks };
    const mark = marks[action.axis];
    if (!mark) {
      marks[action.axis] = {
        mode: "keep",
        value: current.qualities[action.axis],
      };
    } else if (mark.mode === "keep") {
      marks[action.axis] = { ...mark, mode: "avoid" };
    } else {
      delete marks[action.axis];
    }
    return { ...game, marks, exhausted: false };
  }

  let next = -1;
  let bestScore = -Infinity;
  for (let offset = 1; offset < dinners.length; offset++) {
    const index = (game.current + offset) % dinners.length;
    const dinner = dinners[index]!;
    if (!fits(dinner, game.marks)) continue;
    // An unseen match always beats a repeat, however different the repeat is.
    let score = game.seen.includes(index) ? -axes.length - 1 : 0;
    for (const { id } of axes) {
      if (!game.marks[id] && dinner.qualities[id] !== current.qualities[id]) {
        score++;
      }
    }
    if (score > bestScore) {
      next = index;
      bestScore = score;
    }
  }
  return next < 0
    ? { ...game, exhausted: true }
    : {
        ...game,
        current: next,
        exhausted: false,
        seen: game.seen.includes(next) ? game.seen : [...game.seen, next],
        trail: trailTo(game, next),
      };
}
