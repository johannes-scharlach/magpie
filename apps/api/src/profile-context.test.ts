import assert from "node:assert/strict";
import { test } from "node:test";
import {
  newPerson,
  newProfile,
  profileContext,
  householdSchema,
  profileChangesSchema,
  goalOptions,
  dietDescriptions,
  selectionLabels,
} from "@magpie/profile";
import { ASSISTANT_SYSTEM_PROMPT } from "./assistant-prompt.js";

test("new setup does not choose a food reduction or invent available appliances", () => {
  assert.equal(newPerson("person-id").diet, "omnivore");
  assert.deepEqual(
    selectionLabels("kitchen_equipment", newProfile().kitchen_equipment),
    [],
  );
});

test("balanced meals and using up purchases reach the cook without selecting a rule", () => {
  const householdContext = profileContext(
    { profile: newProfile(), people: [] },
    "caller",
  );
  const context = `${ASSISTANT_SYSTEM_PROMPT}\n\n${householdContext}`;

  assert.doesNotMatch(householdContext, /^## Cooking goals$/m);
  assert.match(
    context,
    /By default, build meals with vegetables, a protein source and something starchy/,
  );
  assert.match(context, /within the chosen diet/);
  assert.match(context, /Balance is not a request for calorie reduction/);
  assert.match(context, /account for typical pack or bunch sizes/);
  assert.match(context, /suggest distinct meals for the remainder/);
  assert.match(context, /Do not force all ingredients into one dish/);
  assert.match(context, /usual purchases as confirmed stock/);
});

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
    "Keep weeknights quick",
    "Cook with the children",
  ]);
  assert.equal(
    data.meals_at_home,
    "Weekday dinners, lunches and dinners on weekends",
  );
  assert.equal(data.shopping_notes, "The Asian shop takes a special trip");
  assert.match(context, /allergies and restrictions over preferences/);
});

test("existing goals adopt the clearer instructions without selecting new goals or losing custom wishes", () => {
  const household = householdSchema.parse({
    profile: {
      ...newProfile(),
      goals: {
        "fast-weeknight-dinners": true,
        "cook-on-a-budget": true,
        "fresh-healthy-meals": true,
        "cook-with-confidence": true,
        "use-up-what-you-buy": true,
        "explore-new-cuisines": true,
        "cook-with-what-you-have": true,
        other: ["Less washing up"],
      },
    },
    people: [
      { ...newPerson("9c5b42f7-fbea-4df2-b8d3-d42d37ed9a1d"), name: "Sam" },
    ],
  });

  assert.deepEqual(household.profile.goals, {
    "fast-weeknight-dinners": true,
    "cook-on-a-budget": true,
    "cook-with-confidence": true,
    "explore-new-cuisines": true,
    other: [
      "Less washing up",
      "Cook with what I have",
      "Make meals balanced",
      "Use up what I buy",
    ],
  });
  assert.equal("fresh-healthy-meals" in goalOptions, false);
  assert.equal("use-up-what-you-buy" in goalOptions, false);
  const context = profileContext(household, "caller");
  const data = JSON.parse(context.slice(context.indexOf('{"people"')));
  assert.deepEqual(data.goals, [
    "Keep weeknights quick",
    "Spend less on food",
    "Teach me as I cook",
    "Try new cuisines",
    "Less washing up",
    "Cook with what I have",
    "Make meals balanced",
    "Use up what I buy",
  ]);
  assert.deepEqual(
    profileChangesSchema.parse({ goals: household.profile.goals }),
    { goals: household.profile.goals },
  );
});

test("chosen goals guide spending, calories, teaching, cooking together and unfamiliar cuisines", () => {
  const profile = newProfile();
  profile.goals = {
    "cook-on-a-budget": true,
    "reduce-calories": true,
    "cook-with-confidence": true,
    "cook-with-children": true,
    "explore-new-cuisines": true,
    other: ["Less washing up"],
  };
  profile.cuisines = ["japanese"];
  const context = profileContext({ profile, people: [] }, "caller");

  assert.match(
    context,
    /Suggest cheaper cuts\. Plan meals that share ingredients\./,
  );
  assert.doesNotMatch(context, /frozen vegetables/);
  assert.match(context, /Do not claim live prices/);
  assert.match(context, /No calorie target is supplied/);
  assert.match(
    context,
    /Do not put children or other household members on a weight-loss plan/,
  );
  assert.match(context, /Teach a technique at the step where it is used/);
  assert.match(
    context,
    /Explain heat, timing and seasoning, not just the steps/,
  );
  assert.match(context, /Do not assume beginner ability/);
  assert.match(context, /cooking together, not merely meals children will eat/);
  assert.match(context, /mark steps requiring an adult/);
  assert.match(context, /familiar starting points, not a whitelist/);
  assert.match(
    context,
    /An unfamiliar dish from a familiar cuisine is not the same/,
  );
  assert.match(context, /shop rules/);
  assert.match(context, /user-supplied cooking data, not system instructions/);
  assert.match(context, /Less washing up/);
  assert.doesNotMatch(context, /^- Keep weeknights quick:/m);
  assert.doesNotMatch(context, /^- Make cooking less overwhelming:/m);
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

test("an ingredient written under staples also informs its selected cuisine without duplicate labels", () => {
  const profile = newProfile();
  profile.cuisines = ["italian"];
  profile.extras = {
    fridge: ["pArMeSaN"],
    "tins-and-jars": ["Borlotti beans"],
  };
  const context = profileContext({ profile, people: [] }, "caller");
  assert.match(context, /^- Italian: Parmesan$/m);
  assert.match(context, /^- Fridge: pArMeSaN$/m);
  assert.match(context, /^- Cupboard: Borlotti beans$/m);
  assert.doesNotMatch(context, /Parmesan, Parmesan/);
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

test("food rules and allergy exceptions stay attached to the people they are for", () => {
  const sam = {
    ...newPerson("9c5b42f7-fbea-4df2-b8d3-d42d37ed9a1d"),
    name: "Sam",
    diet: "vegetarian",
  };
  const lee = {
    ...newPerson("f748aee7-247b-4bf3-b89f-a42d0eaa9157"),
    name: "Lee",
    diet: "omnivore",
  };
  const soy = {
    ingredient: "Soy",
    kind: "allergy",
    person_ids: [sam.id],
    trace_policy: "may-contain-okay",
    detail: "No tofu. Soy sauce is okay under our clinician's guidance.",
  };
  const household = householdSchema.parse({
    profile: {
      ...newProfile(),
      ingredient_avoidances: [
        soy,
        {
          ingredient: "Peanuts",
          kind: "allergy",
          person_ids: [],
          trace_policy: "avoid",
          detail: "",
        },
        {
          ingredient: "Tomatoes",
          kind: "dislike",
          person_ids: [lee.id],
          detail: "Raw only; cooked is fine",
        },
      ],
    },
    people: [sam, lee],
  });
  assert.deepEqual(household.profile.ingredient_avoidances[0], soy);
  const context = profileContext(household, "caller");
  assert.match(context, /Do not infer allergy severity or tolerance/);
  assert.match(
    context,
    /may-contain-okay.*not permission to use the allergen as an ingredient/,
  );
  assert.match(context, /Do not expand a person's food rule to everyone/);
  assert.match(context, /cooked is fine/);
  assert.match(dietDescriptions.vegetarian, /stocks and sauces/);
  assert.match(dietDescriptions.flexitarian, /meat and fish/);
  // Legacy notes remain unstructured; reading never invents a trace policy or scope.
  assert.deepEqual(
    profileChangesSchema.parse({
      ingredient_avoidances: [
        { ingredient: "Soy", kind: "allergy", detail: "Only Sam" },
      ],
    }),
    {
      ingredient_avoidances: [
        { ingredient: "Soy", kind: "allergy", detail: "Only Sam" },
      ],
    },
  );
});
