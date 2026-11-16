import type { Session, SupportedStorage } from "@supabase/supabase-js";

/** supabase-js's default key; the test pins it against the library. */
export function authStorageKey(supabaseUrl: string) {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

/**
 * The persisted session, even with an expired access token. Enough to know
 * whose cache to open offline; `getSession()` would wait on a refresh first.
 */
export async function readStoredSession(
  storage: SupportedStorage,
  key: string,
): Promise<Session | null> {
  try {
    const value = await storage.getItem(key);
    const session = value ? (JSON.parse(value) as Session) : null;
    return session?.user?.id ? session : null;
  } catch {
    return null;
  }
}
