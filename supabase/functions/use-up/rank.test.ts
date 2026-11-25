import assert from 'node:assert/strict';

import { rankUseUp } from './rank.ts';
import { useUp } from './handler.ts';

const target = { date: '2026-11-27', slot: 'lunch' } as const;
const paidTests =
  Deno.permissions.querySync({ name: 'env', variable: 'RUN_PAID_USE_UP_TESTS' }).state ===
    'granted' &&
  Deno.env.get('RUN_PAID_USE_UP_TESTS') === '1';

Deno.test('skips assessment when only the target meal or meals outside the window have ingredients', async () => {
  const model = {
    doDecide: () => assert.fail('There is no nearby ingredient to assess'),
  };
  assert.deepEqual(
    await rankUseUp(
      {
        target,
        meals: [
          { ...target, ingredients: [{ name: 'broccoli', quantity: '400 g' }] },
          {
            date: '2026-12-05',
            slot: 'dinner',
            ingredients: [{ name: 'queso fresco', quantity: '80 g' }],
          },
        ],
      },
      { model },
    ),
    [],
  );
});

Deno.test('the transport returns labels only and needs quantified evidence', async () => {
  const request = (body: unknown) =>
    useUp.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const meal = {
    date: target.date,
    slot: 'dinner',
    ingredients: [{ name: 'parsley', quantity: null }],
  };
  const response = await request({ target, meals: [meal] });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ingredients: [] });
  assert.equal((await request({ target, meals: [meal, meal] })).status, 400);
  assert.equal(
    (await request({ target: { ...target, slot: 'breakfast' }, meals: [] }))
      .status,
    400,
  );
});

const lunch = {
  date: '2026-11-25',
  slot: 'lunch',
  ingredients: [
    { name: 'smoked provolone', quantity: '100 g' },
    { name: 'spicy nduja paste', quantity: '50 g' },
    { name: 'dried bay leaves', quantity: '2 leaves' },
    { name: 'dry pasta', quantity: '250 g' },
    { name: 'Meersalz', quantity: '½ TL' },
    { name: 'aceite de oliva', quantity: '1 cucharada' },
  ],
} as const;
const upcomingDinner = {
  date: target.date,
  slot: 'dinner',
  ingredients: [
    { name: 'queso fresco', quantity: '80 g' },
    { name: 'Smoked Provolone', quantity: '40 g' },
    { name: 'parsley', quantity: 'a few leaves' },
    { name: 'gnocchi', quantity: '400 g' },
    { name: 'garlic', quantity: '1 clove' },
    { name: 'butter', quantity: '1 tbsp' },
  ],
} as const;

function assessments(
  index: number,
  probability: number,
  urgency: number,
  value: number,
  storage: 'perishable' | 'shelf_stable' | 'long_keeping' | 'unclear' = 'perishable',
) {
  const lower = Math.floor(urgency);
  const upper = Math.ceil(urgency);
  return {
    [`storage${index}`]: {
      type: 'choice' as const,
      choice: storage,
      probabilities: { [storage]: 1 },
    },
    [`remainder${index}`]: { type: 'boolean' as const, probability },
    [`urgency${index}`]: {
      type: 'score' as const,
      score: urgency,
      probabilities: lower === upper
        ? { [lower]: 1 }
        : { [lower]: upper - urgency, [upper]: urgency - lower },
    },
    [`value${index}`]: {
      type: 'score' as const,
      score: value,
      probabilities: { [value]: 1 },
    },
  };
}

Deno.test('excludes shelf-stable ingredients by storage category across recipe languages', async () => {
  const earlier = { ...lunch, ingredients: [...lunch.ingredients] };
  const later = { ...upcomingDinner, ingredients: [...upcomingDinner.ingredients] };
  const model: NonNullable<NonNullable<Parameters<typeof rankUseUp>[1]>['model']> = {
    doDecide: ({ state: [context], questions }) => {
      assert.equal(context?.type, 'text');
      const evidence = JSON.parse(context.text);
      assert.deepEqual(evidence.target, target);
      assert.deepEqual(evidence.meals, [earlier, later]);
      assert.deepEqual(evidence.candidates, [
        'smoked provolone',
        'spicy nduja paste',
        'dried bay leaves',
        'dry pasta',
        'Meersalz',
        'aceite de oliva',
        'queso fresco',
        'parsley',
        'gnocchi',
        'garlic',
        'butter',
      ]);
      assert.equal(Object.keys(questions).length, 44);
      assert.equal(questions.storage0?.type, 'choice');
      assert.equal(questions.remainder0?.type, 'boolean');
      assert.match(String(questions.remainder0?.instructions), /smoked provolone/);
      assert.equal(questions.urgency0?.type, 'score');
      assert.equal(questions.value0?.type, 'score');
      return Promise.resolve({
        answers: {
          ...assessments(0, 0.9, 1.5, 1),
          ...assessments(1, 0.7, 1.25, 2),
          ...assessments(2, 0.99, 0, 2),
          ...assessments(3, 0.99, 3, 2, 'shelf_stable'),
          ...assessments(4, 0.99, 3, 2, 'shelf_stable'),
          ...assessments(5, 0.99, 3, 2, 'shelf_stable'),
          ...assessments(6, 0.7, 3, 2),
          ...assessments(7, 0.4, 3, 0),
          ...assessments(8, 0.37, 3, 2),
          ...assessments(9, 0.95, 2, 2, 'long_keeping'),
          ...assessments(10, 0.95, 1, 2),
        },
        warnings: [],
      });
    },
  };

  const events: { event: string; details: Record<string, unknown> }[] = [];
  assert.deepEqual(
    await rankUseUp({ target, meals: [later, earlier] }, {
      model,
      trace: (event: string, details: Record<string, unknown>) => events.push({ event, details }),
    }),
    ['queso fresco', 'parsley', 'spicy nduja paste', 'smoked provolone'],
  );
  assert.equal(events.filter(({ event }) => event === 'jev_questions').length, 11);
  assert.deepEqual(
    events.filter(({ event, details }) =>
      event === 'candidate' && details.outcome === 'shelf_stable'
    ).map(({ details }) => details.ingredient),
    ['dry pasta', 'Meersalz', 'aceite de oliva'],
  );
  assert.deepEqual(
    events.filter(({ event }) => event === 'jev_meal').map(({ details }) => details.meal),
    [earlier, later],
  );
  const bayLeaves = events.find(({ event, details }) =>
    event === 'candidate' && details.ingredient === 'dried bay leaves'
  );
  assert.equal(bayLeaves?.details.outcome, 'below_urgency_cutoff');
  assert.deepEqual(bayLeaves?.details.remainder, { type: 'boolean', probability: 0.99 });
  assert.equal(
    events.find(({ event, details }) => event === 'candidate' && details.ingredient === 'gnocchi')
      ?.details.outcome,
    'below_remainder_cutoff',
  );
  assert.equal(
    events.find(({ event, details }) => event === 'candidate' && details.ingredient === 'garlic')
      ?.details.outcome,
    'long_keeping',
  );
  assert.equal(
    events.find(({ event, details }) => event === 'candidate' && details.ingredient === 'butter')
      ?.details.outcome,
    'below_urgency_cutoff',
  );
  const result = events.find(({ event }) => event === 'ranked');
  assert.deepEqual(result?.details.ingredients, [
    'queso fresco',
    'parsley',
    'spicy nduja paste',
    'smoked provolone',
  ]);
});

Deno.test('returns every eligible result in rank order from a plan with only later meals', async () => {
  const later = {
    ...upcomingDinner,
    ingredients: [
      ...upcomingDinner.ingredients.slice(0, 3),
      { name: 'broccoli', quantity: 'half a head' },
      { name: 'chicken breast', quantity: 'one breast' },
    ],
  };
  assert.deepEqual(
    await rankUseUp({ target, meals: [later] }, {
      model: {
        doDecide: () =>
          Promise.resolve({
            answers: {
              ...assessments(0, 0.8, 1.5, 1),
              ...assessments(1, 0.7, 1.5, 1),
              ...assessments(2, 0.5, 3, 0),
              ...assessments(3, 0.6, 2, 1),
              ...assessments(4, 0.8, 3, 2),
            },
            warnings: [],
          }),
      },
    }),
    ['chicken breast', 'broccoli', 'parsley', 'queso fresco', 'Smoked Provolone'],
  );
});

Deno.test({
  name: 'real Jev finds a fresh cheese remainder and passes over dry pasta',
  ignore: !paidTests,
  async fn() {
    const result = await rankUseUp({
      target,
      meals: [
        { ...lunch, date: '2026-11-26', ingredients: [...lunch.ingredients] },
        {
          ...upcomingDinner,
          ingredients: [{ name: 'queso fresco', quantity: '80 g' }],
        },
      ],
    });
    assert.ok(result.includes('queso fresco'));
    assert.ok(!result.includes('dry pasta'));
  },
});
