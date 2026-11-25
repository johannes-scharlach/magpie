import { expect, it } from "vitest";

import { createUseUpCache } from "./use-up-cache";

it("cannot present an old result after a reservation changes, even when the old response arrives last", async () => {
  const pending = new Map<string, (ingredients: string[]) => void>();
  const cache = createUseUpCache(
    (snapshot) => new Promise((resolve) => pending.set(snapshot, resolve)),
  );
  const scope = "household/Friday lunch";
  const published: (readonly string[])[] = [];
  const unsubscribe = cache.subscribe(() => {
    const result = cache.read(
      scope,
      "Wednesday uses cabbage; Friday reserves the rest",
    );
    if (result) published.push(result.ingredients);
  });
  const withoutDinner = cache.refresh(scope, "Wednesday uses cabbage");
  const withDinner = cache.refresh(
    scope,
    "Wednesday uses cabbage; Friday reserves the rest",
  );
  expect(
    cache.read(scope, "Wednesday uses cabbage; Friday reserves the rest"),
  ).toBeNull();

  pending.get("Wednesday uses cabbage; Friday reserves the rest")!([]);
  await withDinner;
  pending.get("Wednesday uses cabbage")!(["cabbage"]);
  await withoutDinner;

  expect(published).toEqual([[]]);
  unsubscribe();
  expect(cache.read(scope, "Wednesday uses cabbage")).toBeNull();
  expect(
    cache.read(scope, "Wednesday uses cabbage; Friday reserves the rest")
      ?.ingredients,
  ).toEqual([]);
});

it("drops an expired result, falls back after failure, and refreshes again later", async () => {
  let now = 0;
  let calls = 0;
  const cache = createUseUpCache(
    async () => {
      calls++;
      if (calls === 2) throw new Error("offline");
      return ["cabbage"];
    },
    () => now,
  );
  const scope = "household/Friday lunch";
  const snapshot = "Wednesday uses cabbage";

  await cache.refresh(scope, snapshot);
  await cache.refresh(scope, snapshot);
  expect(calls).toBe(1);
  expect(cache.read(scope, snapshot)?.ingredients).toEqual(["cabbage"]);
  expect(cache.read("household/Friday dinner", snapshot)).toBeNull();
  expect(cache.read("other household/Friday lunch", snapshot)).toBeNull();
  expect(cache.read(scope, "Wednesday meal moved")).toBeNull();

  now += 15 * 60_000;
  expect(cache.read(scope, snapshot)).toBeNull();
  await cache.refresh(scope, snapshot);
  expect(cache.read(scope, snapshot)?.ingredients).toEqual([]);
  now += 60_000;
  expect(cache.read(scope, snapshot)).toBeNull();
  await cache.refresh(scope, snapshot);
  expect(cache.read(scope, snapshot)?.ingredients).toEqual(["cabbage"]);
});
