import twists from "@magpie/meals/seeded-twists.json";
import { expect, it } from "vitest";

import { seededLook } from "./seeded-look";

it("gives a seeded recipe its short card name and base idea", () => {
  expect(
    seededLook(
      "Schweinekotelett with Zwetschgen, mustard and buttered Spätzle",
    ),
  ).toEqual({
    shortName: "Plum chops & buttered Spätzle",
    idea: "Pan-Seared Pork Chops with Jammy Zwetschgen (Plums)",
  });
});

it("still knows a saved seeded recipe despite case or spacing", () => {
  expect(
    seededLook(
      "  schweinekotelett with Zwetschgen, mustard and  buttered Spätzle ",
    )?.shortName,
  ).toBe("Plum chops & buttered Spätzle");
});

it("leaves the household's own recipes alone", () => {
  expect(seededLook("Grandma's lasagne")).toBeNull();
});

it("covers every seeded direction", () => {
  for (const ideas of Object.values(twists))
    for (const { title } of ideas) expect(seededLook(title)).not.toBeNull();
});
