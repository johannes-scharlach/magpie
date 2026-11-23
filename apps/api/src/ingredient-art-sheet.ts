import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

export const sheetSide = z.number().int().min(1).max(4);

const sheetPlan = z
  .object({
    target: z.string(),
    side: sheetSide,
    cells: z.array(
      z.object({
        ingredient: z.string().min(1),
        cell: z.number().int().nonnegative(),
      }),
    ),
  })
  .refine(
    ({ side, cells }) =>
      cells.every(({ cell }, index) => cell === index && cell < side ** 2) &&
      new Set(cells.map(({ ingredient }) => ingredient)).size === cells.length,
  );

/** Persist before the paid call so retries can leave finished cells blank. */
export async function prepareIngredientArtSheet(
  path: string,
  target: string,
  pending: string[],
  side: number,
): Promise<z.infer<typeof sheetPlan>> {
  const raw = await readFile(path, "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    },
  );
  if (raw !== null) {
    const previous = sheetPlan.parse(JSON.parse(raw));
    if (previous.target !== target)
      throw new Error(
        "The saved sheet belongs to a different Supabase project. Use another --plan.",
      );
    const names = new Set(pending);
    if (previous.cells.some(({ ingredient }) => names.has(ingredient)))
      return previous;
  }
  const plan = sheetPlan.parse({
    target,
    side,
    cells: pending
      .slice(0, side ** 2)
      .map((ingredient, cell) => ({ ingredient, cell })),
  });
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(plan, null, 2) + "\n", {
    mode: 0o600,
    flag: "wx",
  });
  await rename(temp, path);
  return plan;
}
