import assert from "node:assert/strict";
import { test } from "node:test";

import { twistBrief } from "./seeded-twists.js";

const library = {
  "Pork chops with plums": [
    {
      title: "Schweinekotelett with Zwetschgen",
      cuisine: "German",
      pitch: "Mustard and thyme.",
    },
    {
      title: "Five-spice chops with plum glaze",
      cuisine: "Chinese",
      pitch: "Sticky and dark.",
    },
  ],
};

test("a seeded idea with twists gets a brief carrying every twist", () => {
  const brief = twistBrief("Pork chops with plums", library);
  assert.ok(brief);
  assert.match(brief, /Pork chops with plums/);
  assert.match(brief, /Schweinekotelett with Zwetschgen/);
  assert.match(brief, /Five-spice chops with plum glaze/);
  assert.match(brief, /Sticky and dark/);
});

test("an idea without twists takes the normal chat path", () => {
  assert.equal(twistBrief("Shakshuka", library), null);
  assert.equal(twistBrief(undefined, library), null);
});
