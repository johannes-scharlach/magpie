import assert from "node:assert/strict";
import { test } from "node:test";
import { newPerson, newProfile } from "@magpie/profile";

import { suggestionContext } from "./suggestion-context.js";

test("suggestions receive the chosen goal instructions without the whole profile", () => {
  const profile = newProfile();
  profile.kitchen_equipment = {
    "air-fryer": true,
    oven: false,
    other: ["Wok"],
  };
  profile.goals = {
    "fast-weeknight-dinners": true,
    "less-overwhelming-cooking": true,
    "reduce-calories": true,
    "explore-new-cuisines": true,
    other: ["Less washing up"],
  };
  profile.ingredient_avoidances = [
    { ingredient: "Peanuts", kind: "allergy", detail: "Child only" },
    { ingredient: "Alcohol", kind: "restriction", detail: "Including cooking" },
    { ingredient: "Mushrooms", kind: "dislike", detail: "Texture" },
  ];
  profile.restrictions = "No grapefruit with medication";
  profile.main_supermarket = "Aldi";
  profile.shops = [{ name: "Asian supermarket", access: "trip" }];
  profile.cuisines = ["japanese"];
  profile.extras = { japanese: ["Yuzu kosho"] };
  profile.keeps = ["miso"];
  profile.pantry = { rice: true, other: [] };
  profile.fresh_ingredients = { eggs: true, other: [] };
  const adult = {
    ...newPerson("adult-id"),
    name: "Anna",
    user_id: "caller-id",
    meal_times: "Weekday dinners",
  };
  const child = {
    ...newPerson("child-id"),
    name: "Sam",
    age_group: "Child" as const,
    diet: "other" as const,
    diet_other: "Vegetarian, eggs and dairy are fine",
  };

  const context = suggestionContext({
    profile,
    people: [
      adult,
      { ...adult, id: "other-adult-id", user_id: null, name: "Ben" },
      child,
    ],
  });
  for (const line of [
    "Available equipment: Air fryer, Wok",
    "Household: includes a child",
    "Household diets: Flexitarian (plant-forward, includes meat and fish); Vegetarian, eggs and dairy are fine",
    "Must avoid: Peanuts (allergy; Child only); Alcohol (Including cooking)",
    "Dislikes: Mushrooms (Texture)",
    "Other food restrictions: No grapefruit with medication",
  ]) {
    assert.ok(context.includes(line), `Missing cooking brief: ${line}`);
  }
  assert.match(context, /Keep weeknights quick/);
  assert.match(context, /under 30 minutes of prep and hands-on cooking/);
  assert.match(context, /Start with complete mise en place/);
  assert.match(context, /overrides default advice to prep while cooking/);
  assert.match(context, /No calorie target is supplied/);
  assert.match(
    context,
    /Do not put children or other household members on a weight-loss plan/,
  );
  assert.match(context, /familiar starting points, not a whitelist/);
  assert.match(context, /Japanese/);
  assert.match(context, /Less washing up/);
  assert.doesNotMatch(context, /Anna|Sam|Ben|Yuzu kosho|\bmiso\b/);
});

test("undeclared equipment stays unknown and empty sections are omitted", () => {
  const profile = newProfile();
  profile.kitchen_equipment = { other: [] };
  const adult = { ...newPerson("adult-id"), diet: "omnivore" as const };

  assert.equal(
    suggestionContext({ profile, people: [adult] }),
    "Available equipment: none declared",
  );
});

test("a missing household adds no profile context", () => {
  assert.equal(suggestionContext(null), "");
});

test("follow-up suggestions receive the chosen shop rules, not just the main cook", () => {
  const profile = newProfile();
  profile.shops = [
    { name: "Aldi", rule: "everyday" },
    { name: "Asian supermarket", rule: "worth-trip" },
  ];
  const context = suggestionContext({ profile, people: [] });
  assert.match(context, /Aldi/);
  assert.match(context, /worth-trip/);
  assert.match(context, /across meals/);
  assert.match(
    context,
    /Never make a meal or plan depend on an optional source/,
  );
});
