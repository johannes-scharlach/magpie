import assert from "node:assert/strict";
import { test } from "node:test";
import { newProfile } from "@magpie/profile";
import { cuisineDirection } from "./cuisine-direction.js";

const chatIds = [
  "0f7c2a8e-5b1d-4c3e-9a6f-2d8b1e4c7a90",
  "6e1d9b3c-2f4a-4b8e-8c7d-5a0f3e9b1c26",
  "b42e7f10-8c3a-4d9b-a1e5-7f6c0d2b9e83",
  "d9a05c6b-1e7f-4a2c-b8d3-0c4e6f9a2b51",
];

function cooking(...cuisines: string[]) {
  return {
    ...newProfile(),
    cuisines: cuisines.map((cuisine) => ({ cuisine, extras: [] })),
  };
}

test("the direction is one of the cuisines the household cooks, never Everyday", () => {
  for (const id of chatIds) {
    assert.match(
      cuisineDirection(cooking("everyday", "Georgian"), id) ?? "",
      /today's direction is Georgian cooking/,
    );
  }
});

test("a chat keeps its direction from turn to turn", () => {
  const profile = cooking("japanese", "korean", "italian", "mexican");
  for (const id of chatIds) {
    assert.equal(cuisineDirection(profile, id), cuisineDirection(profile, id));
  }
});

test("no cuisines, no direction", () => {
  assert.equal(cuisineDirection(cooking(), chatIds[0]!), null);
  assert.equal(cuisineDirection(cooking("everyday"), chatIds[0]!), null);
});
