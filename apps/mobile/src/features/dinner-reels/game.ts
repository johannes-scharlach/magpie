import type { Marks } from "@/features/dinner-turntable/game";

export const axes = [
  { id: "temp", name: "Temperature" },
  { id: "weight", name: "Weight" },
  { id: "texture", name: "Texture" },
  { id: "base", name: "Base" },
  { id: "protein", name: "Protein" },
  { id: "flavor", name: "Flavor" },
  { id: "cuisine", name: "Cuisine" },
  { id: "veg", name: "Veg" },
] as const;

export type Axis = (typeof axes)[number]["id"];
export type Qualities = Record<Axis, string>;
/** Values the cook set on purpose. They hold for the rest of the game. */
export type Choices = Partial<Qualities>;

export type Dinner = {
  title: string;
  name: string;
  /** Twists of one family share a picture. */
  family: string;
  pitch: string;
  ingredients?: string;
  activeMinutes: number;
  totalMinutes: number;
  qualities: Qualities;
};

export type Game = {
  current: number;
  choices: Choices;
  /** The reels that show, in their slots. */
  reels: Axis[];
  /** The game before the last change, for Back. */
  previous: Game | null;
};

const REELS = 3;

/** The cooking chat speaks the turntable's marks; set values are keeps. */
export function keptMarks(choices: Choices): Marks {
  return Object.fromEntries(
    Object.entries(choices).map(([axis, value]) => [
      axis,
      { mode: "keep", value },
    ]),
  );
}

export type Action =
  | { type: "set"; axis: Axis; value: string }
  | { type: "back" }
  | { type: "spin"; current: number };

export function newGame(dinners: readonly Dinner[], current: number): Game {
  const game = { current, choices: {}, reels: [], previous: null };
  return { ...game, reels: rankReels(dinners, game).slice(0, REELS) };
}

function distance(a: Dinner, b: Dinner): number {
  return axes.filter(({ id }) => a.qualities[id] !== b.qualities[id]).length;
}

function fits(dinner: Dinner, choices: Choices): boolean {
  return axes.every(
    ({ id }) =>
      choices[id] === undefined || dinner.qualities[id] === choices[id],
  );
}

/** Fewest qualities changed first; ties go to the same family (same
 *  picture), then list order. */
function closeness(dinners: readonly Dinner[], from: number) {
  const current = dinners[from]!;
  const away = (index: number) => distance(current, dinners[index]!);
  const sameFamily = (index: number) =>
    dinners[index]!.family === current.family ? 0 : 1;
  return (a: number, b: number) =>
    away(a) - away(b) || sameFamily(a) - sameFamily(b) || a - b;
}

/** The closest dinner with `value` and every choice so far. -1 when none. */
function landing(
  dinners: readonly Dinner[],
  game: Game,
  axis: Axis,
  value: string,
): number {
  if (dinners[game.current]!.qualities[axis] === value) return game.current;
  const candidates = dinners.flatMap((dinner, index) =>
    dinner.qualities[axis] === value && fits(dinner, game.choices)
      ? [index]
      : [],
  );
  return candidates.sort(closeness(dinners, game.current))[0] ?? -1;
}

/** Every other value this reel can reach, gentlest change first. */
function moves(dinners: readonly Dinner[], game: Game, axis: Axis) {
  const values = new Set(dinners.map((dinner) => dinner.qualities[axis]));
  values.delete(dinners[game.current]!.qualities[axis]);
  const byCloseness = closeness(dinners, game.current);
  return [...values]
    .map((value) => ({ value, index: landing(dinners, game, axis, value) }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => byCloseness(a.index, b.index));
}

/** Top to bottom. The current value sits in the middle, the gentlest changes
 *  one step down and up, bigger leaps further out. */
export function reel(
  dinners: readonly Dinner[],
  game: Game,
  axis: Axis,
): string[] {
  const values = moves(dinners, game, axis).map(({ value }) => value);
  const below = values.filter((_, rank) => rank % 2 === 0);
  const above = values.filter((_, rank) => rank % 2 === 1).reverse();
  return [...above, dinners[game.current]!.qualities[axis], ...below];
}

/** Open axes with somewhere to go, best first: the gentlest change (fewest
 *  other qualities moving), then the smallest average change. */
function rankReels(dinners: readonly Dinner[], game: Game): Axis[] {
  const current = dinners[game.current]!;
  return axes
    .filter(({ id }) => game.choices[id] === undefined)
    .map(({ id }) => {
      const changes = moves(dinners, game, id).map(
        ({ index }) => distance(current, dinners[index]!) - 1,
      );
      return {
        id,
        gentlest: changes[0] ?? Infinity,
        average: changes.reduce((sum, n) => sum + n, 0) / changes.length,
      };
    })
    .filter(({ gentlest }) => gentlest !== Infinity)
    .sort((a, b) => a.gentlest - b.gentlest || a.average - b.average)
    .map(({ id }) => id);
}

/** A showing reel keeps its slot while it ranks in the top four. */
function chooseReels(ranked: Axis[], showing: Axis[]): Axis[] {
  const top = ranked.slice(0, REELS + 1);
  const kept = showing.map((axis) => (top.includes(axis) ? axis : undefined));
  const fresh = ranked.filter((axis) => !kept.includes(axis));
  return [...kept.map((axis) => axis ?? fresh.shift()), ...fresh]
    .filter((axis) => axis !== undefined)
    .slice(0, REELS);
}

export function play(
  dinners: readonly Dinner[],
  game: Game,
  action: Action,
): Game {
  if (action.type === "spin") return newGame(dinners, action.current);
  if (action.type === "back") return game.previous ?? game;
  const next = landing(dinners, game, action.axis, action.value);
  if (next < 0 || next === game.current) return game;
  const moved = {
    current: next,
    choices: { ...game.choices, [action.axis]: action.value },
    reels: game.reels,
    previous: game,
  };
  return {
    ...moved,
    reels: chooseReels(rankReels(dinners, moved), game.reels),
  };
}
