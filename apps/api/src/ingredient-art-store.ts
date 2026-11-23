import type { Pool } from "pg";

import type {
  IngredientArtResolution,
  IngredientArtStore,
} from "./ingredient-art.js";

export function ingredientArtStore(
  db: Pick<Pool, "query">,
): IngredientArtStore {
  return {
    async read(keys) {
      const { rows } = await db.query<{
        label_key: string;
        art_id: string | null;
        ingredient_name: string | null;
      }>(
        `SELECT label_key, art_id, ingredient_name
           FROM public.ingredient_art_aliases
          WHERE label_key = ANY($1::text[])`,
        [keys],
      );
      return new Map<string, IngredientArtResolution>(
        rows.map(({ label_key, art_id, ingredient_name }) => [
          label_key,
          art_id !== null
            ? { artId: art_id }
            : { ingredientName: ingredient_name! },
        ]),
      );
    },
    async save(entries) {
      const keys: string[] = [];
      const ids: (string | null)[] = [];
      const names: (string | null)[] = [];
      for (const [key, entry] of entries) {
        keys.push(key);
        ids.push("artId" in entry ? entry.artId : null);
        names.push("ingredientName" in entry ? entry.ingredientName : null);
      }
      await db.query(
        `INSERT INTO public.ingredient_art_aliases (label_key, art_id, ingredient_name)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
         ON CONFLICT (label_key) DO NOTHING`,
        [keys, ids, names],
      );
    },
  };
}

/** Stable identities for T21. Filter out published names when adding art storage. */
export async function listPendingIngredientArt(
  db: Pick<Pool, "query">,
): Promise<string[]> {
  const { rows } = await db.query<{ ingredient_name: string }>(
    `SELECT DISTINCT ingredient_name
       FROM public.ingredient_art_aliases
      WHERE ingredient_name IS NOT NULL
      ORDER BY ingredient_name`,
  );
  return rows.map(({ ingredient_name }) => ingredient_name);
}
