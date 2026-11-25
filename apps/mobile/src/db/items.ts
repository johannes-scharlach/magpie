import { itemNameKey } from "@magpie/meals";

import { magpieUuidV5 } from "@/lib/magpie-uuid";

import { powersync } from "./system";
import {
  resolveShoppingItem,
  writeGoWithout,
  writeMealSwap,
  type MealItemContext,
} from "./meal-ingredients";
import type { ListItem } from "./schema";
import { parseIngredientLines } from "./variants";

// The dedupe key lives in @magpie/meals so the API projects the same
// name_key; re-exported here because every item write in the app uses it.
export { itemNameKey };

/**
 * Ids for list_items are derived from (list_id, name_key) rather than
 * random, so that two people adding "milk" while both offline generate the
 * *same* id. Their writes then converge on one row through PowerSync's
 * upsert instead of racing the unique constraint — where the loser would
 * come back as a 23505 and be discarded, silently losing someone's add.
 */
export function itemId(listId: string, name: string): string {
  return magpieUuidV5(`${listId}:${itemNameKey(name)}`);
}

type StandaloneItem = Pick<
  ListItem,
  | "id"
  | "name"
  | "name_key"
  | "spec"
  | "status"
  | "category_id"
  | "purchase_count"
  | "updated_at"
>;
type ItemAdd = {
  id: string;
  name: string;
  spec: string | null;
  categoryId: string | null;
  undo: ItemAddUndo | null;
};
export type ItemAddUndo = {
  id: string;
  name: string;
  spec: string | null;
  previous: StandaloneItem | null;
};

/** Add a standalone item or reactivate its existing history in one write. */
export async function addItem(
  listId: string,
  name: string,
  spec?: string,
): Promise<ItemAdd | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return;

  const id = itemId(listId, trimmed);
  const nameKey = itemNameKey(trimmed);
  const now = new Date().toISOString();

  // PowerSync's local tables are views, so SQLite cannot UPSERT here.
  // Prefer the deterministic id, but reuse older rows with the same name.
  return powersync.writeTransaction(async (tx) => {
    const existing = await tx.getOptional<StandaloneItem>(
      `SELECT id, name, name_key, spec, status, category_id, purchase_count, updated_at
       FROM list_items
       WHERE list_id = ? AND (id = ? OR (name_key = ? AND planned_meal_id IS NULL))
       ORDER BY id = ? DESC LIMIT 1`,
      [listId, id, nameKey, id],
    );
    if (existing) {
      const nextSpec = spec ?? existing.spec;
      await tx.execute(
        `UPDATE list_items
            SET status = 'active', name = ?, spec = ?, updated_at = ?
          WHERE id = ?`,
        [trimmed, nextSpec, now, existing.id],
      );
      return {
        id: existing.id,
        name: trimmed,
        spec: nextSpec,
        categoryId: existing.category_id,
        undo:
          existing.status === "active"
            ? null
            : {
                id: existing.id,
                name: trimmed,
                spec: nextSpec,
                previous: existing,
              },
      };
    }

    await tx.execute(
      `INSERT INTO list_items
         (id, list_id, name, name_key, category_id, spec, status, purchase_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, 'active', 0, ?, ?)`,
      [id, listId, trimmed, nameKey, spec ?? null, now, now],
    );
    return {
      id,
      name: trimmed,
      spec: spec ?? null,
      categoryId: null,
      undo: { id, name: trimmed, spec: spec ?? null, previous: null },
    };
  });
}

/** Undo this sheet's addition without checking it off or discarding past purchases. */
export async function undoItemAdd({ id, name, spec, previous }: ItemAddUndo) {
  return powersync.writeTransaction(async (tx) => {
    const item = await tx.getOptional<StandaloneItem>(
      `SELECT id, name, name_key, spec, status, category_id, purchase_count, updated_at
       FROM list_items WHERE id = ? AND planned_meal_id IS NULL`,
      [id],
    );
    if (!item || item.status !== "active") return;
    // Server sync can rewrite updated_at. Compare the shopping data itself.
    if (
      item.name !== name ||
      item.spec !== spec ||
      item.purchase_count !== (previous ? previous.purchase_count : 0) ||
      item.category_id !== (previous?.category_id ?? null)
    )
      throw new Error("The shopping item changed after it was added.");

    if (previous) {
      await tx.execute(
        `UPDATE list_items
            SET status = ?, name = ?, name_key = ?, spec = ?, updated_at = ?
          WHERE id = ?`,
        [
          previous.status,
          previous.name,
          previous.name_key,
          previous.spec,
          previous.updated_at,
          id,
        ],
      );
    } else {
      await tx.execute("DELETE FROM list_items WHERE id = ?", [id]);
    }
  });
}

export async function setItemSpec(id: string, spec: string) {
  await powersync.execute(
    `UPDATE list_items SET spec = ?, updated_at = ? WHERE id = ?`,
    [spec.trim() || null, new Date().toISOString(), id],
  );
}

export async function setItemStatus(
  id: string,
  status: "active" | "purchased",
) {
  const now = new Date().toISOString();

  // purchase_count only climbs on the active -> purchased edge, so
  // toggling a checkbox back and forth does not inflate the ranking.
  await powersync.writeTransaction(async (tx) => {
    const row = await tx.getOptional<ListItem & MealItemContext>(
      `SELECT i.*, v.ingredient_lines, pm.ingredient_swaps FROM list_items i
       LEFT JOIN planned_meals pm ON pm.id = i.planned_meal_id
       LEFT JOIN variants v ON v.id = pm.variant_id WHERE i.id = ?`,
      [id],
    );
    if (!row) return;
    const snapshot = resolveShoppingItem(row);
    const orphan =
      status === "active" &&
      row.ingredient_id != null &&
      !parseIngredientLines(row.ingredient_lines).some(
        (line) => line.id === row.ingredient_id,
      );
    await tx.execute(
      `UPDATE list_items
         SET status = ?,
             name = ?, name_key = ?, spec = ?, category_id = ?, ingredient_id = ?,
            purchase_count = purchase_count + CASE
              WHEN ? = 'purchased' AND status = 'active' THEN 1 ELSE 0
            END,
            updated_at = ?
      WHERE id = ?`,
      [
        status,
        snapshot.name,
        itemNameKey(snapshot.name ?? ""),
        snapshot.spec,
        snapshot.category_id,
        orphan ? null : row.ingredient_id,
        status,
        now,
        id,
      ],
    );
  });
}

export async function setItemCategory(id: string, categoryId: string | null) {
  await powersync.execute(
    `UPDATE list_items SET category_id = ?, updated_at = ? WHERE id = ?`,
    [categoryId, new Date().toISOString(), id],
  );
}

/** Rename an item in place (custom edit from the item sheet). */
export async function renameItem(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await powersync.execute(
    `UPDATE list_items SET name = ?, name_key = ?, updated_at = ? WHERE id = ?`,
    [trimmed, itemNameKey(trimmed), new Date().toISOString(), id],
  );
}

/**
 * Shopping edits the meal's choice. It never rewrites a purchased snapshot.
 */
export async function applySwap(id: string, name: string) {
  await powersync.writeTransaction(async (tx) => {
    const item = await tx.getOptional<ListItem>(
      "SELECT * FROM list_items WHERE id = ?",
      [id],
    );
    if (
      !item?.planned_meal_id ||
      !item.variant_id ||
      item.ingredient_id == null ||
      item.status === "purchased"
    ) {
      throw new Error(
        "This item cannot be swapped. Open its meal to choose an ingredient.",
      );
    }
    await writeMealSwap(tx, {
      mealId: item.planned_meal_id,
      variantId: item.variant_id,
      ingredientId: item.ingredient_id,
      name,
    });
  });
}

/** Shop's way of saying the meal goes without this ingredient. */
export async function skipItem(id: string) {
  await powersync.writeTransaction(async (tx) => {
    const item = await tx.getOptional<ListItem>(
      "SELECT * FROM list_items WHERE id = ?",
      [id],
    );
    if (
      !item?.planned_meal_id ||
      !item.variant_id ||
      item.ingredient_id == null ||
      item.status === "purchased"
    ) {
      throw new Error("This item cannot be skipped. Open its meal instead.");
    }
    await writeGoWithout(tx, {
      mealId: item.planned_meal_id,
      variantId: item.variant_id,
      ingredientId: item.ingredient_id,
    });
  });
}

export async function removeItem(id: string) {
  await powersync.execute(`DELETE FROM list_items WHERE id = ?`, [id]);
}
