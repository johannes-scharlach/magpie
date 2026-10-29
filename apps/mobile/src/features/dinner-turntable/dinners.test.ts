import twists from "@magpie/meals/seeded-twists.json";
import { expect, it } from "vitest";

import { dinners } from "./dinners";
import { axes } from "./game";

it("offers each concrete meal direction with its pitch, without adding parent ideas", () => {
  const directions = Object.values(twists).flat();
  expect(dinners.map(({ title, pitch }) => ({ title, pitch }))).toEqual(
    directions.map(({ title, pitch }) => ({ title, pitch })),
  );
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
    expect(["Raw", "Greens", "Roasted", "Pickled", "No veg"]).toContain(
      dinner.qualities.veg,
    );
  }

  const chicken = dinners.find(
    (dinner) =>
      dinner.title ===
      "Classic Greek lemon-oregano chicken thighs with schmaltz potatoes",
  )!;
  expect(chicken.activeMinutes).toBeLessThanOrEqual(20);
  expect(chicken.totalMinutes).toBeGreaterThan(40);
});
