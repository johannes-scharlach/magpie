import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import sharp from "sharp";

import { fillIngredientArtSheet } from "./ingredient-art-batch.js";
import { prepareIngredientArtSheet } from "./ingredient-art-sheet.js";

it("publishes only usable assigned cells and retries in place without redrawing completed ingredients", async () => {
  const plan = [
    { ingredient: "eggplant", cell: 0 },
    { ingredient: "celery root", cell: 1 },
    { ingredient: "tomato paste", cell: 2 },
    { ingredient: "sunchoke", cell: 3 },
  ];
  const fixture = await sharp({
    create: { width: 128, height: 128, channels: 3, background: "#808080" },
  })
    .composite(
      ["#800080", "#bfaa80", "#cc2900", "#cd8844"].map((background, cell) => ({
        input: { create: { width: 20, height: 20, channels: 3, background } },
        left: (cell % 2) * 64 + 22,
        top: Math.floor(cell / 2) * 64 + 22,
      })),
    )
    .png()
    .toBuffer();
  const published = new Map<string, number>();
  const draws: string[] = [];
  let retry = false;
  const tools = {
    draw: async (prompt: string) => {
      draws.push(prompt);
      return fixture;
    },
    matte: async (crop: Uint8Array) => {
      const { data, info } = await sharp(crop).raw().toBuffer({
        resolveWithObject: true,
      });
      assert.equal(info.width, 64);
      assert.equal(info.height, 64);
      const offset = (32 * info.width + 32) * info.channels;
      const [r, g, b] = data.subarray(offset, offset + 3);
      if (r === 204 && !retry) throw new Error("Matting unavailable");
      return sharp(crop)
        .extract({ left: 22, top: 22, width: 20, height: 20 })
        .extend({
          top: 16,
          bottom: 16,
          left: 16,
          right: 16,
          background: { r: r!, g: g!, b: b!, alpha: 0 },
        })
        .linear([1, 1, 1, r === 191 && !retry ? 0 : 1], [0, 0, 0, 0])
        .webp({ lossless: true })
        .toBuffer();
    },
    publish: async (ingredient: string, webp: Uint8Array) => {
      const center = await sharp(webp)
        .extract({ left: 26, top: 26, width: 1, height: 1 })
        .raw()
        .toBuffer();
      published.set(ingredient, center[0]!);
    },
  };

  const pending = () =>
    new Set(
      plan
        .map(({ ingredient }) => ingredient)
        .filter((name) => !published.has(name)),
    );
  const first = await fillIngredientArtSheet(plan, 2, pending(), tools);
  assert.deepEqual(
    first.map(({ ingredient, cell, outcome }) => [ingredient, cell, outcome]),
    [
      ["eggplant", 0, "published"],
      ["celery root", 1, "missing"],
      ["tomato paste", 2, "retry"],
      ["sunchoke", 3, "published"],
    ],
  );
  assert.deepEqual(
    [...published],
    [
      ["eggplant", 128],
      ["sunchoke", 205],
    ],
  );
  assert.match(draws[0]!, /row 1, column 1: "eggplant"/);
  assert.match(draws[0]!, /row 2, column 1: "tomato paste"/);

  retry = true;
  const second = await fillIngredientArtSheet(plan, 2, pending(), tools);
  assert.match(draws[1]!, /row 1, column 1: leave blank/);
  assert.match(draws[1]!, /row 1, column 2: "celery root"/);
  assert.match(draws[1]!, /row 2, column 1: "tomato paste"/);
  assert.ok(second.every(({ outcome }) => outcome === "published"));
  assert.deepEqual(
    [...published],
    [
      ["eggplant", 128],
      ["sunchoke", 205],
      ["celery root", 191],
      ["tomato paste", 204],
    ],
  );
  assert.deepEqual(await fillIngredientArtSheet(plan, 2, pending(), tools), []);
  assert.equal(draws.length, 2);
});

it("persists a sheet before drawing and resumes it ahead of newer misses", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ingredient-art-sheet-"));
  try {
    const path = join(dir, "sheet.json");
    const target = "http://localhost:55321";
    const first = await prepareIngredientArtSheet(
      path,
      target,
      ["apricot", "beetroot"],
      2,
    );
    assert.deepEqual(first.cells, [
      { ingredient: "apricot", cell: 0 },
      { ingredient: "beetroot", cell: 1 },
    ]);
    const resume = await prepareIngredientArtSheet(
      path,
      target,
      ["anchovy", "beetroot"],
      4,
    );
    assert.deepEqual(resume, first);
    await assert.rejects(
      prepareIngredientArtSheet(path, "http://localhost:8000", ["anchovy"], 2),
      /different Supabase/,
    );
    const next = await prepareIngredientArtSheet(path, target, ["anchovy"], 4);
    assert.equal(next.side, 4);
    assert.deepEqual(next.cells, [{ ingredient: "anchovy", cell: 0 }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
