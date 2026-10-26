import assert from "node:assert/strict";
import { test } from "node:test";

import { importSource } from "./recipe-source.js";

const url = "https://www.natashaskitchen.com/classic-risotto-recipe/";

test("the source link is the URL the user imported, whatever the model says", () => {
  assert.deepEqual(
    importSource(url, {
      name: "Natasha's Kitchen",
      url: "https://example.com/",
    }),
    { name: "Natasha's Kitchen", url },
  );
});

test("without a name from the page, the source is named after its site", () => {
  assert.deepEqual(importSource(url, undefined), {
    name: "natashaskitchen.com",
    url,
  });
});

test("a photo has no link, so the source is whoever the photo names", () => {
  assert.deepEqual(importSource(undefined, { name: "Ottolenghi Simple" }), {
    name: "Ottolenghi Simple",
  });
  assert.equal(importSource(undefined, undefined), undefined);
});
