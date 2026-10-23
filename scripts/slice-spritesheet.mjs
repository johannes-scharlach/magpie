import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultOutputDir = fileURLToPath(new URL("../apps/mobile/src/features/onboarding/art/", import.meta.url));

function keyBlue(data) {
  for (let offset = 0; offset < data.length; offset += 4) {
    const maxRG = Math.max(data[offset], data[offset + 1]);
    const blue = data[offset + 2];
    const difference = blue - maxRG;
    data[offset + 3] = difference >= 80 ? 0 : difference <= 25 ? 255
      : Math.round(255 * (1 - (difference - 25) / 55));
    if (data[offset + 3] > 0) data[offset + 2] = Math.min(blue, maxRG);
  }
}

export function filterBorderArtifacts(data, width, height) {
  const visited = new Uint8Array(width * height);
  const components = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || data[idx * 4 + 3] <= 10) continue;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const pixels = [];
      const queue = [idx];
      visited[idx] = 1;

      while (queue.length > 0) {
        const curr = queue.pop();
        pixels.push(curr);
        const cy = Math.floor(curr / width);
        const cx = curr % width;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const ny = cy + dy;
          const nx = cx + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const nidx = ny * width + nx;
            if (!visited[nidx] && data[nidx * 4 + 3] > 10) {
              visited[nidx] = 1;
              queue.push(nidx);
            }
          }
        }
      }

      const compW = maxX - minX + 1;
      const compH = maxY - minY + 1;
      const nearPerimeter = minX <= 4 || maxX >= width - 5 || minY <= 4 || maxY >= height - 5;
      const avgR = pixels.reduce((s, p) => s + data[p * 4], 0) / pixels.length;
      components.push({
        pixels,
        size: pixels.length,
        compW,
        compH,
        nearPerimeter,
        avgR,
      });
    }
  }

  if (components.length <= 1) return;
  components.sort((a, b) => b.size - a.size);
  const largest = components[0];

  for (let i = 1; i < components.length; i++) {
    const comp = components[i];
    const isTinyNoise = comp.size < 20;
    const isBorderLine = comp.nearPerimeter && (
      Math.min(comp.compW, comp.compH) <= 4 ||
      comp.size < largest.size * 0.05 ||
      comp.avgR > 210
    );

    if (isTinyNoise || isBorderLine) {
      for (const p of comp.pixels) {
        data[p * 4 + 3] = 0;
      }
    }
  }
}

export async function sliceSpritesheet({
  inputPath,
  outputDir = defaultOutputDir,
  rows = 3,
  cols = 3,
  ids,
  matting = true,
  experimentalMatting,
  blueKey = false,
  padding = 16,
}) {
  const useMatting = experimentalMatting !== undefined ? experimentalMatting : matting;

  if (!ids || ids.length !== rows * cols) {
    throw new Error(`Expected exactly ${rows * cols} IDs for a ${rows}x${cols} grid, got ${ids ? ids.length : 0}.`);
  }

  const original = await readFile(inputPath);
  let image = await sharp(original).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const hasTransparency = image.data.some((_, idx) => idx % 4 === 3 && image.data[idx] < 255);

  if (!hasTransparency && blueKey) {
    console.log("Running blue-screen keying on spritesheet...");
    keyBlue(image.data);
  }

  const { width, height } = image.info;
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);
  await mkdir(outputDir, { recursive: true });

  let tempDir = null;
  const cellMattedFiles = [];

  if (!hasTransparency && useMatting) {
    tempDir = await mkdtemp(join(tmpdir(), "magpie-slice-"));
    const inputPaths = [];
    const outputPaths = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const minCellX = c * cellW;
        const cellWidth = c === cols - 1 ? width - minCellX : cellW;
        const minCellY = r * cellH;
        const cellHeight = r === rows - 1 ? height - minCellY : cellH;

        const cellPath = join(tempDir, `cell-${r}-${c}.png`);
        const mattedPath = join(tempDir, `matted-${r}-${c}.png`);

        await sharp(original)
          .extract({ left: minCellX, top: minCellY, width: cellWidth, height: cellHeight })
          .png()
          .toFile(cellPath);

        inputPaths.push(cellPath);
        outputPaths.push(mattedPath);
        cellMattedFiles.push(mattedPath);
      }
    }

    console.log(`Running neural foreground matting on ${inputPaths.length} cells...`);
    const mattingScript = join(__dirname, "art-matting.py");
    execFileSync("uv", [
      "run",
      "--no-project",
      "--python",
      "3.12",
      "--script",
      mattingScript,
      "--input",
      ...inputPaths,
      "--output",
      ...outputPaths,
    ], { stdio: "inherit" });
  }

  const results = [];

  try {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const id = ids[index];
        const minCellX = c * cellW;
        const cellWidth = c === cols - 1 ? width - minCellX : cellW;
        const minCellY = r * cellH;
        const cellHeight = r === rows - 1 ? height - minCellY : cellH;

        let cellData;
        let cellInfo;

        if (!hasTransparency && useMatting) {
          const mattedBuffer = await sharp(cellMattedFiles[index])
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          cellData = mattedBuffer.data;
          cellInfo = mattedBuffer.info;
        } else {
          const cropped = await sharp(image.data, { raw: image.info })
            .extract({ left: minCellX, top: minCellY, width: cellWidth, height: cellHeight })
            .raw()
            .toBuffer({ resolveWithObject: true });
          cellData = cropped.data;
          cellInfo = cropped.info;
        }

        filterBorderArtifacts(cellData, cellWidth, cellHeight);

        let minX = cellWidth;
        let maxX = 0;
        let minY = cellHeight;
        let maxY = 0;
        let foundForeground = false;

        for (let y = 0; y < cellHeight; y++) {
          for (let x = 0; x < cellWidth; x++) {
            const alpha = cellData[(y * cellWidth + x) * 4 + 3];
            if (alpha > 10) {
              foundForeground = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (!foundForeground) {
          console.warn(`Warning: No visible foreground found for cell (${r}, ${c}) [${id}]`);
          continue;
        }

        const left = Math.max(0, minX - padding);
        const top = Math.max(0, minY - padding);
        const right = Math.min(cellWidth - 1, maxX + padding);
        const bottom = Math.min(cellHeight - 1, maxY + padding);
        const extractWidth = right - left + 1;
        const extractHeight = bottom - top + 1;

        const cellImage = await sharp(cellData, { raw: cellInfo })
          .extract({ left, top, width: extractWidth, height: extractHeight })
          .png()
          .toBuffer();

        const outPath = join(outputDir, `${id}.png`);
        await writeFile(outPath, cellImage);
        console.log(`Saved sliced asset ${id}.png (${extractWidth}x${extractHeight}) -> ${outPath}`);
        results.push({ id, path: outPath, width: extractWidth, height: extractHeight });
      }
    }
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  return results;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      rows: { type: "string", default: "3" },
      cols: { type: "string", default: "3" },
      ids: { type: "string" },
      output: { type: "string" },
      matting: { type: "boolean", default: true },
      "blue-key": { type: "boolean", default: false },
    },
  });

  const inputPath = positionals[0];
  if (!inputPath) {
    throw new Error("Usage: node scripts/slice-spritesheet.mjs <spritesheet.png|jpg> --ids id1,id2,... [--rows 3] [--cols 3] [--output dir] [--matting]");
  }
  if (!values.ids) {
    throw new Error("--ids is required (comma-separated list of asset IDs in row-major order)");
  }

  const ids = values.ids.split(",").map((s) => s.trim());
  const rows = parseInt(values.rows, 10);
  const cols = parseInt(values.cols, 10);

  await sliceSpritesheet({
    inputPath: resolve(inputPath),
    outputDir: values.output ? resolve(values.output) : defaultOutputDir,
    rows,
    cols,
    ids,
    matting: values.matting && !values["blue-key"],
    blueKey: values["blue-key"],
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
