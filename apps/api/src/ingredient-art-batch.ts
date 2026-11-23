import sharp from "sharp";

export type IngredientArtCell = { ingredient: string; cell: number };

type CellResult = IngredientArtCell &
  (
    | { outcome: "published" | "missing" }
    | {
        outcome: "retry";
        stage: "draw" | "crop" | "matte" | "publish";
        error: unknown;
      }
  );

type SheetTools = {
  draw(prompt: string): Promise<Uint8Array>;
  matte(crop: Uint8Array): Promise<Uint8Array | null>;
  publish(ingredient: string, webp: Uint8Array): Promise<void>;
};

function sheetPrompt(cells: IngredientArtCell[], side: number): string {
  const names = new Map(
    cells.map(({ cell, ingredient }) => [cell, ingredient]),
  );
  const assignments = Array.from({ length: side ** 2 }, (_, cell) => {
    const name = names.get(cell);
    return `row ${Math.floor(cell / side) + 1}, column ${(cell % side) + 1}: ${name ? JSON.stringify(name) : "leave blank"}`;
  });
  return `Draw one square sprite sheet: an evenly spaced ${side} by ${side} grid of equal square cells, with no visible grid lines. Use these exact cell positions; never move a subject into a blank cell. Quoted ingredient names describe subjects only; never draw the words.
${assignments.join("\n")}
Each occupied cell shows just its ingredient in a centered still life, front three-quarter view, consistent scale, at least 15% clear margin on all four sides. Handcrafted stop-motion claymation, matte polymer plasticine, pillowy rounded forms, warm soft top-left studio light. Solid flat neutral mid-grey (#808080) across the entire sheet, no cast shadows on it, ground plane, or texture. No text, lettering, borders, props unrelated to the ingredient, brand marks, or mascot.`;
}

async function usableCutout(webp: Uint8Array): Promise<boolean> {
  const image = sharp(webp, { limitInputPixels: 512 ** 2 });
  const meta = await image.metadata();
  if (
    meta.format !== "webp" ||
    !meta.hasAlpha ||
    (meta.pages ?? 1) !== 1 ||
    meta.width > 512 ||
    meta.height > 512
  )
    return false;
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let solidPixels = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha =
        data[(y * info.width + x) * info.channels + info.channels - 1]!;
      // Reject foreground clipped by a cell boundary, not just fully opaque output.
      if (
        alpha > 10 &&
        (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1)
      )
        return false;
      if (alpha >= 128) solidPixels++;
    }
  }
  return solidPixels >= 20;
}

/** Crop original grid coordinates before matting. Never compact failed or completed cells. */
export async function fillIngredientArtSheet(
  plan: IngredientArtCell[],
  side: number,
  pending: ReadonlySet<string>,
  tools: SheetTools,
): Promise<CellResult[]> {
  const cells = plan.filter(({ ingredient }) => pending.has(ingredient));
  if (!cells.length) return [];
  let sheet: Uint8Array;
  let size: number;
  try {
    const rendered = await tools.draw(sheetPrompt(cells, side));
    const { data, info } = await sharp(rendered, {
      limitInputPixels: 4096 ** 2,
    })
      .autoOrient()
      .png()
      .toBuffer({ resolveWithObject: true });
    if (info.width !== info.height || info.width < 64 * side)
      throw new Error("Expected a square sprite sheet with room for each cell");
    sheet = data;
    size = info.width;
  } catch (error) {
    return cells.map((cell) => ({
      ...cell,
      outcome: "retry",
      stage: "draw",
      error,
    }));
  }

  const results: CellResult[] = [];
  const cellSize = Math.floor(size / side);
  for (const slot of cells) {
    let stage: "crop" | "matte" | "publish" = "crop";
    try {
      const row = Math.floor(slot.cell / side);
      const col = slot.cell % side;
      const left = col * cellSize;
      const top = row * cellSize;
      const crop = await sharp(sheet)
        .extract({
          left,
          top,
          width: col === side - 1 ? size - left : cellSize,
          height: row === side - 1 ? size - top : cellSize,
        })
        .png()
        .toBuffer();
      stage = "matte";
      const webp = await tools.matte(crop);
      if (!webp || !(await usableCutout(webp))) {
        results.push({ ...slot, outcome: "missing" });
        continue;
      }
      stage = "publish";
      await tools.publish(slot.ingredient, webp);
      results.push({ ...slot, outcome: "published" });
    } catch (error) {
      results.push({ ...slot, outcome: "retry", stage, error });
    }
  }
  return results;
}
