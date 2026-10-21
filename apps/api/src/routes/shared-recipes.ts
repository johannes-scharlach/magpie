import { pool } from "../db.js";
import { sharedRecipePage, type SharedRecipe } from "./shared-recipe-page.js";

/** Only what the page shows: never the steps, the household or the sharer. */
async function readSharedRecipe(
  variantId: string,
): Promise<SharedRecipe | null> {
  const rows = await pool.query<SharedRecipe>(
    "SELECT name, description, ingredient_lines FROM variants WHERE id = $1",
    [variantId],
  );
  return rows.rows[0] ?? null;
}

export const sharedRecipes = sharedRecipePage(readSharedRecipe);
