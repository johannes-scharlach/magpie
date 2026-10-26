import assert from "node:assert/strict";
import { test } from "node:test";
import {
  newPerson,
  newProfile,
  profileContext,
  householdSchema,
  profileChangesSchema,
} from "@magpie/profile";

test("household context preserves restrictions and routines without inventing equipment", () => {
  const profile = newProfile();
  profile.goals = {
    "fast-weeknight-dinners": true,
    other: ["Cook with the children"],
  };
  profile.kitchen_equipment = { other: [] };
  profile.meals_at_home = "Weekday dinners, lunches and dinners on weekends";
  profile.other_shops = "The Asian shop takes a special trip";
  const person = {
    ...newPerson("9c5b42f7-fbea-4df2-b8d3-d42d37ed9a1d"),
    name: "Sam",
    user_id: "a5b28b6b-8fba-432b-bfe3-b2e8afca06bc",
    meal_times: "Weekday dinners",
  };
  profile.restrictions = "Severe peanut allergy";
  const child = {
    ...newPerson("f748aee7-247b-4bf3-b89f-a42d0eaa9157"),
    name: "Sam",
    age_group: "Child" as const,
    diet: "vegetarian" as const,
  };
  const context = profileContext(
    { profile, people: [person, child] },
    person.user_id,
  );
  const data = JSON.parse(context.slice(context.indexOf('{"people"')));
  assert.equal(data.people.length, 2);
  assert.equal(data.people[0].is_current_user, true);
  assert.equal(data.people[1].is_current_user, false);
  assert.equal(data.household_restrictions, "Severe peanut allergy");
  assert.match(context, /Flexitarian .* still regularly eats meat and fish/);
  assert.deepEqual(data.equipment, []);
  assert.deepEqual(data.goals, [
    "Fast weeknight dinners",
    "Cook with the children",
  ]);
  assert.equal(
    data.meals_at_home,
    "Weekday dinners, lunches and dinners on weekends",
  );
  assert.equal(data.shopping_notes, "The Asian shop takes a special trip");
  assert.match(context, /allergies and restrictions over preferences/);
});

test("legacy shop access stays readable without being turned into a sourcing rule", () => {
  const profile = newProfile();
  profile.main_supermarket = " Aldi ";
  profile.shops = [
    { name: "Rewe", access: "easy" },
    { name: "Market", access: "detour" },
    { name: "Asian supermarket", access: "trip" },
  ];
  const context = profileContext({ profile, people: [] }, "caller");
  const data = JSON.parse(context.slice(context.indexOf('{"people"')));

  assert.deepEqual(data.shops, [
    { name: "Aldi", access: "easy" },
    { name: "Rewe", access: "easy" },
    { name: "Market", access: "detour" },
    { name: "Asian supermarket", access: "trip" },
  ]);
  assert.equal("main_supermarket" in data, false);
  assert.equal("other_shops" in data, false);
  assert.doesNotMatch(context, /main[- ]shop|additional shops/i);
  assert.equal(
    data.shops.some((shop: { rule?: string }) => shop.rule),
    false,
  );
  assert.match(
    context,
    /Legacy access ratings describe travel effort, not sourcing rules/,
  );
});

test("chosen shop rules survive validation and guide everyday meals, upgrades and worthwhile trips", () => {
  const shops = [
    { name: "Butcher", rule: "everyday" },
    { name: "Aldi", rule: "upgrade" },
    { name: "Asian supermarket", rule: "worth-trip" },
  ];
  const profile = { ...newProfile(), ...profileChangesSchema.parse({ shops }) };
  assert.deepEqual(profile.shops, shops);

  const context = profileContext({ profile, people: [] }, "caller");
  const data = JSON.parse(context.slice(context.indexOf('{"people"')));
  assert.deepEqual(data.shops, shops);
  assert.match(context, /everyday.*baseline/i);
  assert.match(context, /optional upgrades/i);
  assert.match(context, /meaningful improvement/i);
  assert.match(context, /across meals/i);
  assert.match(
    context,
    /Never make a meal or plan depend on an optional source/,
  );
  assert.match(context, /Do not infer a rule from a shop's name or type/);
});

test("an explicit shop access rating takes precedence over the former main shop", () => {
  const household = householdSchema.parse({
    profile: {
      ...newProfile(),
      main_supermarket: " ALDI ",
      shops: [{ name: "Aldi", access: "trip" }],
    },
    people: [
      { ...newPerson("9c5b42f7-fbea-4df2-b8d3-d42d37ed9a1d"), name: "Sam" },
    ],
  });
  const context = profileContext(household, "caller");
  const data = JSON.parse(context.slice(context.indexOf('{"people"')));

  assert.deepEqual(data.shops, [{ name: "Aldi", access: "trip" }]);
});

test("onboarding choices retain their meaning through validation and assistant context", () => {
  const household = householdSchema.parse({
    profile: {
      ...newProfile(),
      ingredient_avoidances: [
        { ingredient: "Peanuts", kind: "allergy", detail: "Sam" },
        { ingredient: "Coriander", kind: "dislike", detail: "" },
      ],
      shops: [{ name: "Asian supermarket", access: "detour" }],
    },
    people: [
      {
        ...newPerson("9c5b42f7-fbea-4df2-b8d3-d42d37ed9a1d"),
        name: "Sam",
        portion_reference: 0.75,
      },
    ],
  });
  const context = profileContext(household, "caller");
  const data = JSON.parse(context.slice(context.indexOf('{"people"')));
  assert.equal(data.people[0].portion_reference, 0.75);
  assert.equal(data.ingredient_avoidances[0].kind, "allergy");
  assert.equal(data.ingredient_avoidances[1].kind, "dislike");
  assert.deepEqual(data.shops, [
    { name: "Asian supermarket", access: "detour" },
  ]);
  assert.match(context, /portion_reference.*extra portions/);
  const acceptsPortion = (portion_reference: number) =>
    householdSchema.safeParse({
      ...household,
      people: [{ ...household.people[0], portion_reference }],
    }).success;
  assert.equal(acceptsPortion(0.25), true);
  assert.equal(acceptsPortion(0.3), true);
  assert.equal(acceptsPortion(2), true);
  assert.equal(acceptsPortion(0.2), false);
  assert.equal(acceptsPortion(0.31), false);
  assert.equal(acceptsPortion(2.05), false);
});

test("cuisines show what the household keeps for each, shared items under every cuisine", () => {
  const household = householdSchema.parse({
    profile: {
      ...newProfile(),
      keeps: [
        "sesame-oil",
        "umeboshi",
        "miso",
        "gochujang",
        "tofu",
        "frozen-peas",
      ],
      cuisines: ["japanese", "korean", "Georgian"],
      extras: {
        japanese: ["Yuzu kosho"],
        Georgian: ["Adjika"],
        cupboard: ["Polenta"],
        thai: ["Fish sauce"],
      },
    },
    people: [
      { ...newPerson("9c5b42f7-fbea-4df2-b8d3-d42d37ed9a1d"), name: "Sam" },
    ],
  });
  const context = profileContext(household, "caller");
  assert.match(
    context,
    /^- Japanese: Miso, Sesame oil, Umeboshi, Yuzu kosho$/m,
  );
  assert.match(context, /^- Korean: Gochujang, Sesame oil$/m);
  assert.match(context, /^- Georgian: Adjika$/m);
  // Staples are kept, not cooked, so they get their own section; a cuisine
  // switched off says nothing.
  assert.match(
    context,
    /## Staples they keep\n[^#]*^- Cupboard: Polenta\n- Fridge: Tofu\n- Freezer: Peas$/m,
  );
  assert.doesNotMatch(context, /Tins & jars/);
  assert.doesNotMatch(context, /Fish sauce/);
  assert.match(
    context,
    /invitation to be used, not a request to use it every time/,
  );

  const none = profileContext(
    { ...household, profile: newProfile() },
    "caller",
  );
  assert.doesNotMatch(none, /Cuisines they cook/);
  assert.doesNotMatch(none, /Staples they keep/);

  const staplesOnly = profileContext(
    { ...household, profile: { ...newProfile(), keeps: ["tofu"] } },
    "caller",
  );
  assert.match(staplesOnly, /^- Fridge: Tofu$/m);
  assert.doesNotMatch(staplesOnly, /Cuisines they cook/);
});

test("old pantry and fresh answers stay out of the assistant context", () => {
  const household = householdSchema.parse({
    profile: {
      ...newProfile(),
      pantry: {
        cannedFoods: true,
        "canned-tomatoes": true,
        other: ["Polenta"],
      },
      fresh_ingredients: { "greek-yoghurt": true, other: ["Chinese cabbage"] },
    },
    people: [
      { ...newPerson("9c5b42f7-fbea-4df2-b8d3-d42d37ed9a1d"), name: "Sam" },
    ],
  });
  const context = profileContext(household, "caller");
  assert.doesNotMatch(
    context,
    /pantry|fresh|Canned|Polenta|Greek yoghurt|Chinese cabbage/i,
  );
});

test("editing one profile section never inserts defaults into other sections", () => {
  assert.deepEqual(profileChangesSchema.parse({ main_supermarket: "Aldi" }), {
    main_supermarket: "Aldi",
  });
  assert.deepEqual(profileChangesSchema.parse({ shops: [] }), { shops: [] });
  assert.deepEqual(profileChangesSchema.parse({ keeps: ["miso"] }), {
    keeps: ["miso"],
  });
});
