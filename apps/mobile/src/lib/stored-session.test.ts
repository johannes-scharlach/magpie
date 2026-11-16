import { createClient } from "@supabase/supabase-js";
import { expect, test } from "vitest";

import { authStorageKey, readStoredSession } from "./stored-session";

test("reads the session auth-js persisted, without the network", async () => {
  const url = "https://abcdefgh.supabase.co";
  const items = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: string) => void items.set(key, value),
    removeItem: async (key: string) => void items.delete(key),
  };
  let online = true;
  const client = createClient(url, "publishable-key", {
    auth: { storage, autoRefreshToken: false, persistSession: true },
    global: {
      fetch: async () => {
        if (!online) throw new TypeError("Network request failed");
        return Response.json({
          access_token: "access",
          token_type: "bearer",
          expires_in: 3600,
          // Already expired: what a launch after an hour away looks like.
          expires_at: Math.floor(Date.now() / 1000) - 60,
          refresh_token: "refresh",
          user: { id: "user-1", email: "dev@magpie.local" },
        });
      },
    },
  });
  await client.auth.signInWithPassword({
    email: "dev@magpie.local",
    password: "magpie-dev",
  });
  online = false;

  const session = await readStoredSession(storage, authStorageKey(url));

  expect(session?.user.id).toBe("user-1");
});
