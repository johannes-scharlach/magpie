import { householdSchema, type Household } from "@magpie/profile";

import { pool } from "./db.js";

/**
 * The household a list belongs to, or null before onboarding has written a
 * profile. Both the chat route and the MCP instructions read it fresh so an
 * edit in the app reaches the next turn.
 */
export async function readHousehold(listId: string): Promise<Household | null> {
  const profile = await pool.query(
    "SELECT * FROM household_profiles WHERE id = $1",
    [listId],
  );
  if (!profile.rows[0]) return null;
  const people = await pool.query(
    "SELECT * FROM household_people WHERE list_id = $1 ORDER BY created_at, id",
    [listId],
  );
  return householdSchema.parse({
    profile: profile.rows[0],
    people: people.rows,
  });
}
