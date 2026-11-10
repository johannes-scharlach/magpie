import { Pool, type PoolClient } from "pg";

import { env } from "./env.js";

// Single pool for the process. `pg` handles reconnects; we reuse it across
// requests. DATABASE_URL is required at boot via env.ts.
export const pool = new Pool({
  connectionString: env.databaseUrl,
});

/**
 * Lets triggers see who acted (`auth.uid()`), as they do for PowerSync
 * uploads. Transaction-local; the connection keeps its own role.
 */
export async function actAs(client: PoolClient, userId: string): Promise<void> {
  await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [
    userId,
  ]);
}

const committed = new WeakMap<PoolClient, (() => void)[]>();

/** Runs `task` once this transaction commits; never after a rollback. */
export function afterCommit(client: PoolClient, task: () => void): void {
  committed.get(client)?.push(task);
}

/** The outer operation owns the transaction; persistence functions receive it. */
export async function inTransaction<T>(
  userId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  const tasks: (() => void)[] = [];
  committed.set(client, tasks);
  let result: T;
  try {
    await client.query("BEGIN");
    await actAs(client, userId);
    result = await work(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    committed.delete(client);
    client.release();
  }
  for (const task of tasks) task();
  return result;
}
