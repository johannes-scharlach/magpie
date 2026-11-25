export const NO_USE_UP_INGREDIENTS: readonly string[] = [];
const RESULT_TTL_MS = 15 * 60_000;
const FAILURE_TTL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_TARGETS = 12;

type Result = { ingredients: readonly string[]; expiresAt: number };
type Entry = {
  snapshot: string;
  controller: AbortController;
  pending?: Promise<void>;
  result?: Result;
};

/** Keep only the latest evidence for each household/target, in memory only. */
export function createUseUpCache(
  load: (snapshot: string, signal: AbortSignal) => Promise<readonly string[]>,
  now = Date.now,
) {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function notify() {
    for (const listener of listeners) listener();
  }
  function read(scope: string, snapshot: string): Result | null {
    const entry = entries.get(scope);
    if (entry?.snapshot !== snapshot) return null;
    const result = entry.result;
    return result && result.expiresAt > now() ? result : null;
  }

  function clear(scope: string) {
    const entry = entries.get(scope);
    if (!entry) return;
    entry.controller.abort();
    entries.delete(scope);
    if (entry.result) notify();
  }

  function expire(scope: string) {
    const result = entries.get(scope)?.result;
    if (result && result.expiresAt <= now()) clear(scope);
  }

  function refresh(scope: string, snapshot: string): Promise<void> {
    const previous = entries.get(scope);
    if (previous?.snapshot === snapshot) {
      if (previous.pending) return previous.pending;
      if (read(scope, snapshot)) return Promise.resolve();
    }
    clear(scope);
    if (entries.size >= MAX_TARGETS) {
      const oldest = entries.keys().next();
      if (!oldest.done) clear(oldest.value);
    }
    const controller = new AbortController();
    const entry: Entry = { snapshot, controller };
    entries.set(scope, entry);
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    entry.pending = (async () => {
      try {
        const ingredients = await load(snapshot, controller.signal);
        if (controller.signal.aborted) throw new Error("Assessment expired");
        entry.result = { ingredients, expiresAt: now() + RESULT_TTL_MS };
      } catch {
        entry.result = {
          ingredients: NO_USE_UP_INGREDIENTS,
          expiresAt: now() + FAILURE_TTL_MS,
        };
      } finally {
        clearTimeout(timeout);
      }
    })().finally(() => {
      entry.pending = undefined;
      if (entries.get(scope) === entry) notify();
    });
    return entry.pending;
  }

  return { read, refresh, clear, expire, subscribe };
}
