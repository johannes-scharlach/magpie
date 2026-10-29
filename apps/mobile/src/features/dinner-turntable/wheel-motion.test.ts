import { expect, it } from "vitest";

import { angularVelocity, isTangential, rotationDelta } from "./wheel-motion";

it("follows the finger around the center, with opposite directions at the top and bottom", () => {
  expect(rotationDelta({ x: 0, y: -100 }, { x: 100, y: -100 })).toBeCloseTo(45);
  expect(rotationDelta({ x: 0, y: 100 }, { x: 100, y: 100 })).toBeCloseTo(-45);
  expect(rotationDelta({ x: 100, y: 0 }, { x: 100, y: 100 })).toBeCloseTo(45);
});

it("crosses the angle boundary without jumping and can accumulate a full turn", () => {
  const point = (degrees: number) => ({
    x: 100 * Math.cos((degrees * Math.PI) / 180),
    y: 100 * Math.sin((degrees * Math.PI) / 180),
  });
  expect(rotationDelta(point(179), point(-179))).toBeCloseTo(2);
  expect(rotationDelta(point(-179), point(179))).toBeCloseTo(-2);

  let turn = 0;
  for (let angle = 0; angle < 360; angle += 90) {
    turn += rotationDelta(point(angle), point(angle + 90));
  }
  expect(turn).toBeCloseTo(360);
});

it("hands off tangential release speed, not horizontal speed or movement toward the center", () => {
  const top = angularVelocity({ x: 0, y: -100 }, { x: 200, y: 0 });
  const bottom = angularVelocity({ x: 0, y: 100 }, { x: 200, y: 0 });
  expect(top).toBeCloseTo((2 * 180) / Math.PI);
  expect(bottom).toBeCloseTo(-top);
  expect(angularVelocity({ x: 100, y: 0 }, { x: 0, y: 400 })).toBeCloseTo(
    2 * top,
  );
  expect(angularVelocity({ x: 0, y: 100 }, { x: 0, y: 200 })).toBe(0);
  expect(angularVelocity({ x: 0, y: 0 }, { x: 200, y: 200 })).toBe(0);
  expect(rotationDelta({ x: 0, y: 100 }, { x: 0, y: 0 })).toBe(0);
});

it("distinguishes turning the rim from scrolling toward or away from the center", () => {
  expect(isTangential({ x: 0, y: 100 }, { x: 20, y: 2 })).toBe(true);
  expect(isTangential({ x: 100, y: 0 }, { x: 2, y: -20 })).toBe(true);
  expect(isTangential({ x: 0, y: 100 }, { x: 2, y: -20 })).toBe(false);
  expect(isTangential({ x: 0, y: 0 }, { x: 20, y: 20 })).toBe(false);
});
