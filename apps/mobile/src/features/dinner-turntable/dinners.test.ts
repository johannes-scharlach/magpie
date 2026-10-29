import twists from "@magpie/meals/seeded-twists.json";
import { expect, it } from "vitest";

import seeds from "@/features/chat/seeded-ideas.json";

import { dinners } from "./dinners";
import { axes } from "./game";

it("makes every seed and twist playable with eight qualities and low active work, including longer roasts", () => {
  const titles = [
    ...seeds.map((idea) => idea.title),
    ...Object.values(twists).flatMap((directions) =>
      directions.map((twist) => twist.title),
    ),
  ];
  expect(dinners.map((dinner) => dinner.title).sort()).toEqual(titles.sort());
  expect(new Set(dinners.map((dinner) => dinner.title)).size).toBe(
    dinners.length,
  );

  for (const dinner of dinners) {
    expect(dinner.name.trim()).not.toBe("");
    expect(dinner.pitch.trim()).not.toBe("");
    expect(dinner.activeMinutes).toBeGreaterThan(0);
    expect(dinner.activeMinutes).toBeLessThanOrEqual(40);
    expect(dinner.totalMinutes).toBeGreaterThanOrEqual(dinner.activeMinutes);
    expect(Object.keys(dinner.qualities).sort()).toEqual(
      axes.map((axis) => axis.id).sort(),
    );
    for (const quality of Object.values(dinner.qualities)) {
      expect(quality.trim()).not.toBe("");
    }
    expect(["Classic", "A twist"]).toContain(dinner.qualities.fam);
  }

  const chicken = dinners.find((dinner) =>
    dinner.title.startsWith("Lemon-Herb Roasted Chicken"),
  )!;
  expect(chicken.activeMinutes).toBeLessThanOrEqual(20);
  expect(chicken.totalMinutes).toBeGreaterThan(40);
});
