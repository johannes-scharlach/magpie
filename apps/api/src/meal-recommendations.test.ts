import assert from "node:assert/strict";
import test from "node:test";
import { Client, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { newProfile, newPerson } from "@magpie/profile";

import {
  recommendMeals,
  rankMeals,
  type MealCandidate,
  type RecommendationState,
} from "./meal-recommendations.js";
import {
  recommendationCandidates,
  recommendationHousehold,
  seededCandidates,
  seededMeal,
} from "./meal-recommendation-context.js";

const candidate = (id: string, name = id): MealCandidate => ({
  id,
  recipeId: id,
  seedKey: null,
  name,
  description: "",
  totalTime: "25 min",
  cuisine: "italian",
  tags: [],
  equipment: [],
  effort: "easy",
  ingredients: [],
});

test("the pool caps cookbook recipes at 80 and fills with distinct available seeds", () => {
  const cookbook = Array.from({ length: 90 }, (_, i) =>
    candidate(`cookbook${i}`),
  );
  const seeds = Array.from({ length: 110 }, (_, i) => ({
    ...candidate(`seed${i}`),
    seedKey: `seed${i}`,
  }));
  assert.equal(recommendationCandidates(cookbook, seeds).length, 100);
  assert.equal(
    recommendationCandidates(cookbook, seeds).filter((r) => !r.seedKey).length,
    80,
  );
  assert.equal(recommendationCandidates([], seeds).length, 100);
  assert.equal(recommendationCandidates([], seeds.slice(0, 3)).length, 3);
});

test("selection context omits personal identity but preserves scoped rules; bundled seeds are cookable", () => {
  const person = {
    ...newPerson("9c5b42f7-fbea-4df2-b8d3-d42d37ed9a1d"),
    name: "Private name",
  };
  const profile = {
    ...newProfile(),
    restrictions: "No peanuts",
    meal_ideas_brief: "Quick dinners",
    new_dishes: "Deprecated new-dish guidance",
  };
  const context = JSON.stringify(
    recommendationHousehold({ profile, people: [person] }),
  );
  assert.ok(!context.includes(person.name));
  assert.ok(!context.includes(person.id));
  assert.match(context, /No peanuts/);
  assert.match(context, /Quick dinners/);
  assert.ok(!context.includes("Deprecated new-dish guidance"));
  assert.ok(!context.includes('"newDishes"'));
  const seed = seededMeal(
    "Schweinekotelett with Zwetschgen, mustard and buttered Spätzle",
  );
  assert.ok(seed.recipeIngredient.length > 0);
  assert.ok(seed.recipeInstructions.length > 0);
});

test("ranks by contextual fit with stable ties and excludes firm conflicts", () => {
  const candidates = ["lower", "conflict", "higher", "tie", "ungraded"].map(
    (id) => candidate(id),
  );
  const grades = {
    lower: { conflict: 0, fit: 0.3 },
    conflict: { conflict: 0.2, fit: 1 },
    higher: { conflict: 0.01, fit: 0.9 },
    tie: { conflict: 0.01, fit: 0.9 },
  };
  assert.deepEqual(
    rankMeals(candidates, grades).map((c) => c.id),
    ["higher", "tie", "lower"],
  );
});

test(
  "real Jev puts a requested quick weeknight dinner ahead of a slow favourite",
  {
    skip: !process.env.TYPESAFE_AI_API_KEY,
    timeout: 60000,
  },
  async () => {
    const slow = {
      ...candidate("slow", "Mushroom and spinach lasagne"),
      description:
        "Make the sauces from scratch, assemble and bake. An hour of hands-on work.",
      totalTime: "90 min",
      effort: "more work",
      ingredients: ["lasagne sheets", "mushrooms", "spinach", "milk", "cheese"],
    };
    const quick = {
      ...candidate("quick", "Tomato and cannellini beans on toast"),
      description:
        "Warm canned beans with tomatoes while the bread toasts. Ready in 15 minutes.",
      totalTime: "15 min",
      ingredients: ["canned cannellini beans", "tomatoes", "bread"],
    };
    const ranked = await recommendMeals({
      date: "2026-11-10",
      slot: "dinner",
      household: recommendationHousehold({
        profile: {
          ...newProfile(),
          meal_ideas_brief:
            "Lasagne is our favourite. We also enjoy beans on toast. Weeknight dinners must take no more than 20 minutes from start to table.",
        },
        people: [],
      }),
      plannedMeals: [],
      candidates: [slow, quick],
    });
    assert.equal(ranked[0]?.id, "quick");
  },
);

test(
  "real Jev uses existing choices to fulfil a weekly minimum without making it a maximum",
  {
    skip: !process.env.TYPESAFE_AI_API_KEY,
    timeout: 60000,
  },
  async () => {
    const gnocchi = {
      ...candidate(
        "gnocchi",
        "Potato gnocchi with roasted tomatoes and mozzarella",
      ),
      ingredients: ["potato gnocchi", "tomatoes", "mozzarella"],
    };
    const rice = {
      ...candidate("rice", "Ginger tofu rice bowl with broccoli"),
      cuisine: "chinese",
      ingredients: ["rice", "tofu", "broccoli", "ginger", "soy sauce"],
    };
    const plannedMeals: RecommendationState["plannedMeals"] = [
      {
        date: "2026-10-31",
        slot: "dinner",
        name: "Chicken biryani",
        ingredients: ["chicken", "rice"],
      },
      {
        date: "2026-11-02",
        slot: "dinner",
        name: "Mushroom risotto",
        ingredients: ["rice", "mushrooms"],
      },
      {
        date: "2026-11-03",
        slot: "dinner",
        name: "Lentil soup",
        ingredients: ["lentils", "carrots"],
      },
      {
        date: "2026-11-04",
        slot: "dinner",
        name: "Cheese omelette",
        ingredients: ["eggs", "cheese"],
      },
      {
        date: "2026-11-05",
        slot: "dinner",
        name: "Chicken with couscous",
        ingredients: ["chicken", "couscous"],
      },
      {
        date: "2026-11-06",
        slot: "dinner",
        name: "Baked potatoes with beans",
        ingredients: ["potatoes", "beans"],
      },
      {
        date: "2026-11-07",
        slot: "dinner",
        name: "Salmon and green salad",
        ingredients: ["salmon", "lettuce"],
      },
    ];
    const twoRiceDinners = plannedMeals.map((meal) =>
      meal.date === "2026-11-05"
        ? { ...meal, name: "Chicken biryani", ingredients: ["chicken", "rice"] }
        : meal,
    );
    const brief =
      "We want rice for dinner at least twice each Monday-to-Sunday week. Otherwise potato gnocchi is our favourite. We enjoy tofu rice bowls too.";
    const cases = [
      { brief, plannedMeals, expected: "rice" },
      { brief, plannedMeals: twoRiceDinners, expected: "gnocchi" },
      {
        brief:
          "We want rice for dinner at least twice each Monday-to-Sunday week. Tofu rice bowls are our favourite; gnocchi is fine too. More rice dinners are welcome.",
        plannedMeals: twoRiceDinners,
        expected: "rice",
      },
    ];
    for (const { brief, plannedMeals, expected } of cases) {
      const ranked = await recommendMeals({
        date: "2026-11-08",
        slot: "dinner",
        household: recommendationHousehold({
          profile: { ...newProfile(), meal_ideas_brief: brief },
          people: [],
        }),
        plannedMeals,
        candidates: [gnocchi, rice],
      });
      assert.equal(ranked[0]?.id, expected, brief);
    }
  },
);

test(
  "real Jev follows the brief on nearby repeats in either direction",
  {
    skip: !process.env.TYPESAFE_AI_API_KEY,
    timeout: 60000,
  },
  async () => {
    const corn = {
      ...candidate(
        "corn",
        "Charred corn and zucchini skillet with warm feta and mint",
      ),
      ingredients: ["corn", "zucchini", "feta", "mint"],
      mealFamily: "recipe:corn",
    };
    const stew = {
      ...candidate("stew", "Tomato and white bean stew with basil toast"),
      ingredients: ["tomatoes", "white beans", "bread", "basil"],
    };
    for (const [brief, expected] of [
      [
        "We like corn skillets and bean stews. Give us different dinners on consecutive days.",
        "stew",
      ],
      [
        "We like corn skillets and bean stews. This week we want our corn and zucchini skillet for dinner on consecutive days.",
        "corn",
      ],
    ] as const) {
      const results = await Promise.all(
        ["2026-11-06", "2026-11-08"].map(async (date) => {
          const ranked = await recommendMeals({
            date: "2026-11-07",
            slot: "dinner",
            household: recommendationHousehold({
              profile: { ...newProfile(), meal_ideas_brief: brief },
              people: [],
            }),
            plannedMeals: [
              {
                date,
                slot: "dinner",
                name: corn.name,
                ingredients: corn.ingredients,
                mealFamily: corn.mealFamily,
              },
            ],
            candidates: [corn, stew],
          });
          return ranked[0]?.id;
        }),
      );
      assert.deepEqual(results, [expected, expected], brief);
    }
  },
);

test(
  "real Jev keeps cheese and herb spins from crowding out different meals in the shortlist",
  {
    skip: !process.env.TYPESAFE_AI_API_KEY,
    timeout: 60000,
  },
  async () => {
    const candidates = [
      {
        ...candidate(
          "corn-mint",
          "Charred corn and zucchini skillet with warm feta and mint",
        ),
        ingredients: ["corn", "zucchini", "feta", "mint"],
      },
      {
        ...candidate(
          "corn-basil",
          "Blistered corn and zucchini with basil and pecorino",
        ),
        ingredients: ["corn", "zucchini", "pecorino", "basil"],
      },
      {
        ...candidate(
          "corn-labneh",
          "Charred corn and zucchini over cold garlic labneh",
        ),
        ingredients: ["corn", "zucchini", "labneh", "garlic"],
      },
      {
        ...candidate("stew", "Tomato and white bean stew with basil toast"),
        ingredients: ["tomatoes", "white beans", "bread", "basil"],
      },
      {
        ...candidate("chicken", "Lemon chicken traybake with potatoes"),
        ingredients: ["chicken", "lemon", "potatoes"],
      },
    ];
    const ranked = await recommendMeals({
      date: "2026-11-07",
      slot: "dinner",
      household: {
        preferences:
          "Loves corn and zucchini skillets. Also enjoys bean stews and chicken traybakes.",
      },
      plannedMeals: [],
      candidates,
    });
    assert.equal(ranked.filter((c) => c.id.startsWith("corn-")).length, 1);
    assert.ok(ranked.some((c) => c.id === "stew"));
    assert.ok(ranked.some((c) => c.id === "chicken"));
  },
);

test(
  "known seeded meal identities respect a brief for different lunch and dinner and keep one representative",
  {
    skip: !process.env.TYPESAFE_AI_API_KEY,
    timeout: 60000,
  },
  async () => {
    const candidates = seededCandidates();
    const lunch = candidates.find(
      (c) =>
        c.name === "Charred corn and zucchini skillet with warm feta and mint",
    )!;
    assert.ok(
      lunch.mealFamily,
      "Bundled spins must retain their shared meal identity",
    );
    const ranked = await recommendMeals({
      date: "2026-11-07",
      slot: "dinner",
      household: {
        brief:
          "We love corn and zucchini skillets, feta, labneh and mint. Give us different meals for lunch and dinner; a different cheese or sauce on the same dish doesn't count. We also enjoy other weeknight meals.",
      },
      plannedMeals: [
        {
          date: "2026-11-07",
          slot: "lunch",
          name: lunch.name,
          ingredients: lunch.ingredients,
          mealFamily: lunch.mealFamily,
        },
      ],
      candidates,
    });
    assert.ok(
      ranked.slice(0, 3).every((c) => c.mealFamily !== lunch.mealFamily),
      "Lunch spins must not lead dinner suggestions",
    );
    const families = ranked.map((c) => c.mealFamily);
    assert.equal(
      new Set(families).size,
      families.length,
      "Each seeded meal gets one representative",
    );
  },
);

test(
  "a full 100-candidate request fits Jev's normal context and produces distinct choices",
  {
    skip: !process.env.TYPESAFE_AI_API_KEY,
    timeout: 60000,
  },
  async () => {
    const seeds = seededCandidates();
    const candidates = [
      ...seeds,
      ...seeds.slice(0, 100 - seeds.length).map((c, i) => ({
        ...c,
        id: `cookbook-${i}`,
        recipeId: `cookbook-${i}`,
        seedKey: null,
        name: `Saved: ${c.name}`,
      })),
    ];
    assert.equal(candidates.length, 100);
    const ranked = await recommendMeals(
      {
        date: "2026-11-07",
        slot: "dinner",
        household: {
          preferences: "Familiar weeknight meals with useful variety.",
        },
        plannedMeals: [],
        candidates,
      },
      AbortSignal.timeout(30000),
    );
    assert.equal(ranked.length, 10);
    assert.equal(new Set(ranked.map((c) => c.mealFamily)).size, ranked.length);
  },
);

test(
  "real Jev distinguishes a rhyme from a renamed repeat and excludes an explicit allergen",
  {
    skip: !process.env.TYPESAFE_AI_API_KEY,
    timeout: 60000,
  },
  async () => {
    const candidates = [
      {
        ...candidate("repeat", "Spaghetti with tomato and basil"),
        ingredients: ["spaghetti", "tomatoes", "basil"],
      },
      {
        ...candidate("rhyme", "Tomato and white bean stew with basil toast"),
        ingredients: ["white beans", "tomatoes", "basil", "bread"],
      },
      {
        ...candidate("allergen", "Peanut noodles"),
        ingredients: ["noodles", "peanut butter"],
      },
    ];
    const ranked = await recommendMeals({
      date: "2026-11-07",
      slot: "dinner",
      household: {
        boundaries: "Severe peanut allergy. Never suggest peanuts.",
        preferences: "Enjoys Italian flavours and tomato dishes.",
      },
      plannedMeals: [
        {
          date: "2026-11-06",
          slot: "dinner",
          name: "Pasta pomodoro",
          ingredients: ["spaghetti", "tomatoes", "basil"],
        },
      ],
      candidates,
    });
    assert.ok(ranked.some((r) => r.id === "rhyme"));
    assert.ok(!ranked.some((r) => r.id === "allergen"));
    assert.ok(
      ranked.findIndex((r) => r.id === "repeat") === -1 ||
        ranked.findIndex((r) => r.id === "rhyme") <
          ranked.findIndex((r) => r.id === "repeat"),
    );
  },
);

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const localDatabase =
  databaseUrl &&
  ["localhost", "127.0.0.1", "::1"].includes(new URL(databaseUrl).hostname);
test(
  "recommendations include the preceding fortnight and every future plan, excluding only the target slot and other households",
  { skip: !localDatabase },
  async () => {
    const { loadRecommendationState } =
      await import("./meal-recommendation-store.js");
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      await client.query(`
      CREATE TEMP TABLE list_members (list_id uuid, user_id uuid);
      CREATE TEMP TABLE recipes (id uuid, list_id uuid, created_at timestamptz, cuisine text, tags jsonb);
      CREATE TEMP TABLE variants (id uuid, recipe_id uuid, name text, description text, total_time text, equipment jsonb, effort text, ingredient_lines jsonb, created_at timestamptz);
      CREATE TEMP TABLE household_profiles (id uuid);
      CREATE TEMP TABLE household_people (id uuid, list_id uuid, created_at timestamptz);
      CREATE TEMP TABLE planned_meals (list_id uuid, slot_date date, meal text, name text, variant_id uuid);
    `);
      const user = randomUUID(),
        home = randomUUID(),
        other = randomUUID();
      await client.query("INSERT INTO list_members VALUES ($1,$2)", [
        home,
        user,
      ]);
      await client.query(
        "INSERT INTO planned_meals VALUES ($1,'2026-10-24','dinner','first included',null), ($1,'2026-10-23','dinner','too old',null), ($1,'2026-11-07','lunch','same-day lunch',null), ($1,'2026-11-07','dinner','being replaced',null), ($1,'2026-11-08','dinner','tomorrow',null), ($1,'2026-12-07','dinner','distant plan',null), ($2,'2026-11-06','dinner','other household',null)",
        [home, other],
      );
      const recipe = randomUUID();
      await client.query(
        "INSERT INTO recipes VALUES ($1,$2,now(),'italian','[]')",
        [recipe, home],
      );
      await client.query(
        "INSERT INTO variants VALUES ($1,$2,'older',null,null,'[]','easy','[]',now()-interval '1 day'), ($3,$2,'latest',null,null,'[]','easy','[]',now())",
        [randomUUID(), recipe, randomUUID()],
      );
      const state = await loadRecommendationState(
        client as PoolClient,
        user,
        home,
        "2026-11-07",
        "dinner",
      );
      assert.deepEqual(
        state.plannedMeals.map((m) => m.name),
        ["distant plan", "tomorrow", "same-day lunch", "first included"],
      );
      assert.equal(state.candidates.filter((c) => !c.seedKey).length, 1);
      assert.equal(state.candidates[0]?.name, "latest");
      await assert.rejects(
        loadRecommendationState(
          client as PoolClient,
          user,
          other,
          "2026-11-07",
          "dinner",
        ),
        /access/i,
      );
    } finally {
      await client.end();
    }
  },
);
