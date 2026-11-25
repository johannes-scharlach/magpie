import { env } from "@/lib/env";

export const traceUseUpLocally =
  __DEV__ && env.supabaseUrl.startsWith("http://");

export function logUseUp(event: string, details: Record<string, unknown>) {
  if (traceUseUpLocally) {
    console.info("[use-up]", JSON.stringify({ event, ...details }));
  }
}
