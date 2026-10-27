import assert from "node:assert/strict";
import { test } from "node:test";
import { newPerson, newProfile } from "@magpie/profile";

import { suggestionContext } from "./suggestion-context.js";

test("suggestions receive cooking rules and the household's food guidance", () => {
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
  assert.match(context, /Anna|Sam|Ben/);
  assert.match(context, /Child only/);
  assert.match(context, /Including cooking/);
  assert.match(context, /Texture/);
  assert.match(context, /No grapefruit with medication/);
  assert.match(context, /Yuzu kosho/);
});

test("undeclared equipment stays unknown and empty sections are omitted", () => {
  const profile = newProfile();
  profile.kitchen_equipment = { other: [] };
  const adult = { ...newPerson("adult-id"), diet: "omnivore" as const };

  const context = suggestionContext({ profile, people: [adult] });
  assert.match(context, /Available equipment: none declared/);
  assert.doesNotMatch(context, /## Food boundaries/);
});

test("follow-ups retain per-person diets, allergy handling, familiar cooking and usual ingredients", () => {
  const sam = {
    ...newPerson("sam-id"),
    name: "Sam",
    diet: "vegetarian" as const,
    meal_times: "Weekday dinners",
    portion_reference: 0.75,
  };
  const lee = {
    ...newPerson("lee-id"),
    name: "Lee",
    diet: "omnivore" as const,
  };
  const profile = newProfile();
  profile.ingredient_avoidances = [
    {
      ingredient: "Soy",
      kind: "allergy",
      person_ids: [sam.id],
      trace_policy: "may-contain-okay",
      detail: "No tofu; soy sauce is okay",
    },
  ];
  profile.cuisines = ["japanese"];
  profile.keeps = ["miso", "frozen-peas"];
  const context = suggestionContext({ profile, people: [sam, lee] });
  assert.match(context, /sam-id/);
  assert.match(context, /Weekday dinners/);
  assert.match(context, /0.75/);
  assert.match(context, /No tofu; soy sauce is okay/);
  assert.match(context, /may-contain-okay/);
  assert.match(context, /not permission to use the allergen as an ingredient/);
  assert.match(context, /not confirmed stock/);
  assert.match(context, /familiar starting points, not a whitelist/);
  assert.match(context, /Japanese:.*Miso/);
  assert.match(context, /Freezer: Peas/);
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
