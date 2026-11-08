import twists from "@magpie/meals/seeded-twists.json";

/** A seeded recipe's short card name, and the base idea its art is keyed by. */
export type SeededLook = { shortName: string; idea: string };

const key = (title: string) => title.trim().toLowerCase().replace(/\s+/g, " ");

const looks = new Map(
  Object.entries(twists).flatMap(([idea, directions]) =>
    directions.map(
      (d) => [key(d.title), { shortName: d.dinner.name, idea }] as const,
    ),
  ),
);

/** By name, so it also finds seeded recipes already saved to the cookbook. */
export function seededLook(name: string): SeededLook | null {
  return looks.get(key(name)) ?? null;
}
