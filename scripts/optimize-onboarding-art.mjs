import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";

const TILE_SIZE = 512;
const HERO_SIZE = 1024;
const QUALITY = 82;
const CONCURRENCY = Math.max(2, availableParallelism());
const retiredBanners = new Set(["art-diet.png", "art-kitchen.png", "art-pantry.png", "art-fresh.png"]);
const defaultTargets = [
  {
    input: fileURLToPath(new URL("../apps/mobile/src/features/onboarding/art/", import.meta.url)),
    output: fileURLToPath(new URL("../apps/mobile/src/features/onboarding/art/optimized/", import.meta.url)),
  },
  {
    input: fileURLToPath(new URL("../apps/mobile/src/features/chat/art/", import.meta.url)),
    output: fileURLToPath(new URL("../apps/mobile/src/features/chat/art/optimized/", import.meta.url)),
  },
];

async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function optimizeFolder({ input, output }) {
  const entries = await readdir(input, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".png") && !retiredBanners.has(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (!files.length) throw new Error(`No current PNG masters found in ${input}.`);
  await mkdir(output, { recursive: true });

  const results = await mapConcurrent(files, CONCURRENCY, async (file) => {
    const srcPath = join(input, file);
    const destPath = join(output, file.replace(/\.png$/, ".webp"));
    const [srcStat, destStat] = await Promise.all([
      stat(srcPath),
      stat(destPath).catch(() => null),
    ]);

    // Fast-path: if output exists and is newer than source, skip re-encoding
    if (destStat && destStat.mtimeMs >= srcStat.mtimeMs) {
      const meta = await sharp(destPath).metadata();
      return {
        file,
        width: meta.width,
        height: meta.height,
        srcBytes: srcStat.size,
        optBytes: destStat.size,
        cached: true,
      };
    }

    const size = file === "art-welcome.png" || file.startsWith("welcome-") ? HERO_SIZE : TILE_SIZE;
    const original = await readFile(srcPath);
    const { data, info } = await sharp(original)
      .rotate()
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY, alphaQuality: 100, effort: 6 })
      .toBuffer({ resolveWithObject: true });

    const previous = await readFile(destPath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (!previous?.equals(data)) await writeFile(destPath, data);

    return {
      file,
      width: info.width,
      height: info.height,
      srcBytes: original.length,
      optBytes: data.length,
      cached: false,
    };
  });

  let sourceBytes = 0;
  let optimizedBytes = 0;

  for (const res of results) {
    sourceBytes += res.srcBytes;
    optimizedBytes += res.optBytes;
    console.log(`${res.file}: ${res.width}x${res.height}, ${(res.srcBytes / 1024).toFixed(1)} KiB -> ${(res.optBytes / 1024).toFixed(1)} KiB`);
  }

  const savings = ((1 - optimizedBytes / sourceBytes) * 100).toFixed(1);
  console.log(`Total: ${files.length} images, ${(sourceBytes / 1024 / 1024).toFixed(2)} MiB -> ${(optimizedBytes / 1024 / 1024).toFixed(2)} MiB (${savings}% smaller)`);
  return { filesCount: files.length, sourceBytes, optimizedBytes };
}

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      output: { type: "string" },
    },
  });

  const targets = values.input
    ? [{ input: resolve(values.input), output: resolve(values.output ?? join(values.input, "optimized")) }]
    : defaultTargets.map((t) => ({ input: resolve(t.input), output: resolve(t.output) }));

  let totalFiles = 0;
  let totalSourceBytes = 0;
  let totalOptimizedBytes = 0;

  for (const target of targets) {
    const res = await optimizeFolder(target);
    totalFiles += res.filesCount;
    totalSourceBytes += res.sourceBytes;
    totalOptimizedBytes += res.optimizedBytes;
  }

  if (targets.length > 1) {
    const savings = ((1 - totalOptimizedBytes / totalSourceBytes) * 100).toFixed(1);
    console.log(`Grand Total: ${totalFiles} images, ${(totalSourceBytes / 1024 / 1024).toFixed(2)} MiB -> ${(totalOptimizedBytes / 1024 / 1024).toFixed(2)} MiB (${savings}% smaller)`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
