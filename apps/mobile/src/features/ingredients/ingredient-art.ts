import { knownIngredientArt } from "@magpie/profile";
import { useEffect, useState } from "react";
import { z } from "zod";

import { bundledArtworkSource } from "@/features/onboarding/artwork";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/** Shared by ingredient surfaces. A miss means render the caller's label alone. */
export function bundledIngredientArt(label: string): number | undefined {
  const id = knownIngredientArt(label);
  return id ? bundledArtworkSource(id) : undefined;
}

const maxLabels = 12;
const responseSchema = z.object({ artIds: z.array(z.string().nullable()) });

/** Decorative art only. Lookup never delays the caller's label or interaction. */
export function useIngredientArt(
  labels: readonly string[],
): (label: string) => number | string | undefined {
  const [learned, setLearned] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const requestKey = JSON.stringify(
    [...new Set(labels.map((label) => label.trim()))]
      .filter(
        (label) => label && label.length <= 96 && !knownIngredientArt(label),
      )
      .sort(),
  );
  useEffect(() => {
    const pending = JSON.parse(requestKey) as string[];
    if (!pending.length) return;
    let active = true;
    let controller: AbortController | undefined;
    async function resolve() {
      const { data } = await supabase.auth.getSession();
      if (!data.session || !active) return;
      for (let i = 0; active && i < pending.length; i += maxLabels) {
        const batch = pending.slice(i, i + maxLabels);
        const request = new AbortController();
        controller = request;
        const timeout = setTimeout(() => request.abort(), 15_000);
        try {
          const response = await fetch(`${env.apiUrl}/v1/ingredient-art`, {
            signal: request.signal,
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${data.session.access_token}`,
            },
            body: JSON.stringify({ labels: batch }),
          });
          if (!response.ok) return;
          const result = responseSchema.safeParse(await response.json());
          if (
            !active ||
            !result.success ||
            result.data.artIds.length !== batch.length
          )
            return;
          const { artIds } = result.data;
          setLearned((previous) => {
            const next = new Map(previous);
            for (const [index, label] of batch.entries()) {
              const id = artIds[index];
              if (id) next.set(label, id);
              else next.delete(label);
            }
            return next;
          });
        } finally {
          clearTimeout(timeout);
        }
      }
    }
    // The text-only tile is the ordinary offline/failed state.
    void resolve().catch(() => undefined);
    return () => {
      active = false;
      controller?.abort();
    };
  }, [requestKey]);

  return (label) => {
    const id = learned.get(label.trim());
    const bundled = bundledIngredientArt(label);
    if (bundled !== undefined || !id) return bundled;
    if (/^generated-[a-f0-9]{64}$/.test(id)) {
      return `${env.supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/ingredient-art/${id}.webp`;
    }
    return bundledArtworkSource(id);
  };
}
