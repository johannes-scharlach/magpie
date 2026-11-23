import assert from "node:assert/strict";
import { it } from "node:test";
import { knownIngredientArt } from "@magpie/profile";
import {
  resolveIngredientArt,
  type IngredientArtResolution,
} from "./ingredient-art.js";

it("resolves exact art identifiers and curated equivalents, not overlapping names", () => {
  assert.equal(knownIngredientArt("pantry-rice"), "pantry-rice");
  assert.equal(
    knownIngredientArt("Tinned tomatoes"),
    "ingredient-canned-tomatoes",
  );
  assert.equal(knownIngredientArt("Tomato paste"), undefined);
});

it("learns only clear aliases to existing art and reuses them across requests", async () => {
  const saved = new Map<string, IngredientArtResolution>();
  const store = {
    listPublished: async () => new Map<string, string>(),
    read: async () => new Map(saved),
    save: async (entries: ReadonlyMap<string, IngredientArtResolution>) => {
      for (const [key, value] of entries) saved.set(key, value);
    },
  };
  const result = await resolveIngredientArt(
    ["Rice", "Kichererbsen", "Tomato purée", "Unknown spice", "Kichererbsen"],
    store,
    async (names, catalog) => {
      assert.deepEqual(names, [
        "kichererbsen",
        "tomato purée",
        "unknown spice",
      ]);
      assert.equal(catalog.get("ingredient-chickpeas"), "Chickpeas");
      return new Map([
        ["kichererbsen", { artId: "ingredient-chickpeas", confidence: 0.99 }],
        [
          "tomato purée",
          { artId: "ingredient-canned-tomatoes", confidence: 0.35 },
        ],
        ["unknown spice", { artId: "ingredient-made-up", confidence: 0.99 }],
      ]);
    },
  );
  assert.deepEqual(result, [
    "pantry-rice",
    "ingredient-chickpeas",
    null,
    null,
    "ingredient-chickpeas",
  ]);
  assert.equal(saved.size, 1);
  assert.deepEqual(
    await resolveIngredientArt([" KICHERERBSEN "], store, async () =>
      assert.fail("Do not ask Jev for a saved alias"),
    ),
    ["ingredient-chickpeas"],
  );
});

it("hands off distinct recognized ingredient names, not unclassified labels or notes", async () => {
  const saved = new Map<string, IngredientArtResolution>();
  const store = {
    listPublished: async () => new Map<string, string>(),
    read: async () => new Map(saved),
    save: async (entries: ReadonlyMap<string, IngredientArtResolution>) => {
      for (const [key, value] of entries) saved.set(key, value);
    },
  };
  const labels = [
    "Aubergine",
    "Eggplant",
    "Tomato paste",
    " tomato paste ",
    "Celery root",
    "Cabbage\nFor Alice on Friday",
    "Something for Alice",
  ];
  assert.deepEqual(
    await resolveIngredientArt(labels, store, async (names) => {
      assert.deepEqual(names, ["celery root", "something for alice"]);
      return new Map([["celery root", { missing: true, confidence: 0.98 }]]);
    }),
    labels.map(() => null),
  );
  assert.deepEqual(
    [...saved.values()],
    [
      { ingredientName: "eggplant" },
      { ingredientName: "eggplant" },
      { ingredientName: "tomato paste" },
      { ingredientName: "celery root" },
    ],
  );
  assert.deepEqual(
    await resolveIngredientArt(labels.slice(0, 4), store, async () =>
      assert.fail("Do not ask Jev again about queued ingredient names"),
    ),
    [null, null, null, null],
  );
});

it("resolves published art through existing aliases and offers it for new translations", async () => {
  const saved = new Map<string, IngredientArtResolution>();
  const published = new Map<string, string>();
  const artId = `generated-${"a".repeat(64)}`;
  const store = {
    listPublished: async () => new Map(published),
    read: async () => new Map(saved),
    save: async (entries: ReadonlyMap<string, IngredientArtResolution>) => {
      for (const [key, value] of entries) saved.set(key, value);
    },
  };
  const neverJudge = async () =>
    assert.fail("Known food should not need a judgment");
  assert.deepEqual(
    await resolveIngredientArt(["Aubergine", "Tomatenmark"], store, neverJudge),
    [null, null],
  );
  published.set(artId, "eggplant");
  assert.deepEqual(
    await resolveIngredientArt(
      ["Aubergine", "Eggplant", "Tomatenmark", "Rice"],
      store,
      neverJudge,
    ),
    [artId, artId, null, "pantry-rice"],
  );
  assert.deepEqual(
    await resolveIngredientArt(["Berenjena"], store, async (names, catalog) => {
      assert.deepEqual(names, ["berenjena"]);
      assert.equal(catalog.get(artId), "eggplant");
      return new Map([["berenjena", { artId, confidence: 0.99 }]]);
    }),
    [artId],
  );
  assert.deepEqual(
    await resolveIngredientArt(["Berenjena"], store, neverJudge),
    [artId],
  );
});
