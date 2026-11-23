import assert from "node:assert/strict";
import test from "node:test";
import type { UseUpRequest } from "@magpie/meals";
import { Experimental_DecisionMockModelV4 } from "ai/test";

import { rankUseUp } from "./use-up.js";
import { useUp } from "./routes/use-up.js";

const target = { date: "2026-11-27", slot: "lunch" } as const;
const cabbage = (quantity: string) => [{ name: "cabbage", quantity }];

test("moving the Wednesday cabbage to Saturday cannot supply Friday lunch", async () => {
  const model = new Experimental_DecisionMockModelV4({
    doDecide: async () =>
      assert.fail("There is no earlier ingredient to assess"),
  });
  assert.deepEqual(
    await rankUseUp(
      {
        target,
        meals: [
          { date: target.date, slot: "lunch", ingredients: cabbage("400 g") },
          { date: target.date, slot: "dinner", ingredients: cabbage("800 g") },
          {
            date: "2026-11-28",
            slot: "dinner",
            ingredients: cabbage("1 small head (400 g)"),
          },
        ],
      },
      { model },
    ),
    [],
  );
});

test("the transport returns labels only and never infers from a later-only meal", async () => {
  const request = (body: unknown) =>
    useUp.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const meal = {
    date: target.date,
    slot: "dinner",
    ingredients: cabbage("400 g"),
  };
  const response = await request({ target, meals: [meal] });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ingredients: [] });
  assert.equal((await request({ target, meals: [meal, meal] })).status, 400);
  assert.equal(
    (await request({ target: { ...target, slot: "breakfast" }, meals: [] }))
      .status,
    400,
  );
});

const wednesday = {
  date: "2026-11-25",
  slot: "dinner",
  ingredients: [
    ...cabbage("1 small head (400 g)"),
    { name: "dry pasta", quantity: "250 g" },
  ],
} as const;

test("one assessment sees repeated earlier uses and later demand, but not dates outside the window", async () => {
  const source = { ...wednesday, ingredients: [...wednesday.ingredients] };
  const repeat = {
    date: target.date,
    slot: "lunch",
    ingredients: cabbage("100 g"),
  } as const;
  const dinner = {
    ...target,
    slot: "dinner",
    ingredients: cabbage("50 g"),
  } as const;
  const meals = [
    dinner,
    { ...source, date: "2026-11-19", ingredients: cabbage("1 head") },
    repeat,
    source,
    { ...dinner, date: "2026-12-05", ingredients: cabbage("2 heads") },
  ];
  const state: UseUpRequest = { target: { ...target, slot: "dinner" }, meals };
  const reservation = { ...dinner, slot: "treat" } as const;
  state.meals.push(reservation);
  let assessments = 0;
  const model = new Experimental_DecisionMockModelV4({
    doDecide: async ({ state: [context], questions }) => {
      assessments++;
      assert.equal(context?.type, "text");
      const evidence = JSON.parse(context.text);
      assert.deepEqual(evidence.target, state.target);
      assert.deepEqual(evidence.earlier, [source, repeat]);
      assert.deepEqual(evidence.later, [reservation]);
      assert.deepEqual(evidence.candidates, ["cabbage", "dry pasta"]);
      assert.equal(Object.keys(questions).length, 2);
      return {
        answers: {
          candidate0: { type: "boolean", probability: 0.95 },
          candidate1: { type: "boolean", probability: 0.05 },
        },
        warnings: [],
      };
    },
  });
  assert.deepEqual(await rankUseUp(state, { model }), ["cabbage"]);
  assert.equal(assessments, 1);
});

for (const [dinner, expected] of [
  ["800 g", []],
  ["2 leaves (50 g)", ["cabbage"]],
  [null, ["cabbage"]],
] as const) {
  test(
    `real Jev assesses Friday lunch when Friday dinner uses ${dinner ?? "no cabbage"}`,
    { skip: !process.env.TYPESAFE_AI_API_KEY, timeout: 35_000 },
    async () => {
      const meals = [
        { ...wednesday, ingredients: [...wednesday.ingredients] },
        ...(dinner
          ? [
              {
                date: target.date,
                slot: "dinner" as const,
                ingredients: cabbage(dinner),
              },
            ]
          : []),
      ];
      assert.deepEqual(await rankUseUp({ target, meals }), expected);
    },
  );
}

test(
  "real Jev consumes repeated same-day lettuce before predicting a remainder",
  { skip: !process.env.TYPESAFE_AI_API_KEY, timeout: 35_000 },
  async () => {
    const earlier = {
      date: "2026-11-26",
      slot: "dinner" as const,
      ingredients: [
        { name: "romaine lettuce", quantity: "half a head (150 g)" },
      ],
    };
    const lunch = { ...earlier, date: target.date, slot: "lunch" as const };
    const dinner = { ...target, slot: "dinner" as const };
    assert.deepEqual(await rankUseUp({ target: dinner, meals: [earlier] }), [
      "romaine lettuce",
    ]);
    assert.deepEqual(
      await rankUseUp({ target: dinner, meals: [earlier, lunch] }),
      [],
    );
  },
);
