import { PowerSyncDatabase } from "@powersync/react-native";

import { SupabaseConnector } from "./connector";
import { AppSchema } from "./schema";

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: "magpie.db" },
});

export const connector = new SupabaseConnector();

/** Resolves once the local database is open; syncing continues on its own. */
export async function connectPowerSync() {
  await powersync.init();
  // connect() waits for the first attempt. Offline, that is a ~30s token
  // refresh before failing, and the cache must not wait for it.
  powersync.connect(connector).catch((error: unknown) => {
    console.warn("PowerSync connect failed", error);
  });
}

export async function disconnectPowerSync() {
  // Clears the local database as well — use on sign-out so the next user
  // on this device does not inherit the previous one's cached rows.
  await powersync.disconnectAndClear();
}
