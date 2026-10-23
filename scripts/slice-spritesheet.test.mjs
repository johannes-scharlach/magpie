import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { filterBorderArtifacts, sliceSpritesheet } from "./slice-spritesheet.mjs";

test("filterBorderArtifacts removes disconnected border lines touching cell perimeter", () => {
  const width = 100;
  const height = 100;
  const data = Buffer.alloc(width * height * 4, 0);

  // 1. Draw a main subject in the center (40x40 = 1600 px)
  for (let y = 30; y < 70; y++) {
    for (let x = 30; x < 70; x++) {
      const idx = (y * width + x) * 4;
      data[idx] = 120;
      data[idx + 1] = 60;
      data[idx + 2] = 40;
      data[idx + 3] = 255;
    }
  }

  // 2. Draw a stray border line along x = 0 (1px wide, 50px long)
  for (let y = 0; y < 50; y++) {
    const idx = (y * width + 0) * 4;
    data[idx] = 255;
    data[idx + 1] = 255;
    data[idx + 2] = 255;
    data[idx + 3] = 255;
  }

  // 3. Draw a tiny noise speck at (80, 80)
  data[(80 * width + 80) * 4 + 3] = 255;

  filterBorderArtifacts(data, width, height);

  // Main subject should still be intact
  assert.equal(data[(50 * width + 50) * 4 + 3], 255);
  // Stray border line should be zeroed out
  assert.equal(data[(10 * width + 0) * 4 + 3], 0);
  assert.equal(data[(0 * width + 0) * 4 + 3], 0);
  // Tiny noise speck should be zeroed out
  assert.equal(data[(80 * width + 80) * 4 + 3], 0);
});

test("slices a 3x3 transparent sprite sheet into 9 cropped assets", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "magpie-spritesheet-"));
  t.after(() => rm(dir, { recursive: true, force: true }));

  // Create a 300x300 image with 9 small 20x20 squares (already transparent)
  const width = 300;
  const height = 300;
  const pixels = Buffer.alloc(width * height * 4, 0);

  // For each of the 3x3 cells, put a 20x20 square in the center
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const startX = c * 100 + 40;
      const startY = r * 100 + 40;
      for (let y = startY; y < startY + 20; y++) {
        for (let x = startX; x < startX + 20; x++) {
          const idx = (y * width + x) * 4;
          pixels[idx] = 200;
          pixels[idx + 1] = 100;
          pixels[idx + 2] = 50;
          pixels[idx + 3] = 255;
        }
      }
    }
  }

  const sheetPath = join(dir, "sheet.png");
  await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toFile(sheetPath);

  const ids = [
    "item-1", "item-2", "item-3",
    "item-4", "item-5", "item-6",
    "item-7", "item-8", "item-9",
  ];

  const results = await sliceSpritesheet({
    inputPath: sheetPath,
    outputDir: dir,
    rows: 3,
    cols: 3,
    ids,
    experimentalMatting: false,
    padding: 2,
  });

  assert.equal(results.length, 9);
  for (let i = 0; i < 9; i++) {
    assert.equal(results[i].id, ids[i]);
    // 20x20 with padding 2 on each side = 24x24
    assert.equal(results[i].width, 24);
    assert.equal(results[i].height, 24);
  }
});
