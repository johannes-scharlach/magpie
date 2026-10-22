import seededTwists from "./seeded-twists.json" with { type: "json" };

export type Twist = { title: string; cuisine: string; pitch: string };
export type TwistLibrary = Record<string, Twist[] | undefined>;

/**
 * Tapping a seeded idea opens into directions, not a Sketch (spec 0013).
 * Twists are written offline and kept far apart; the fast model fits them
 * to the household. Null sends the idea down the normal chat path.
 */
export function twistBrief(
  idea: string | undefined,
  library: TwistLibrary = seededTwists,
): string | null {
  const twists = idea ? library[idea] : undefined;
  if (!idea || !twists?.length) return null;
  return `## Opening a seeded idea

The user tapped "${idea}" in the app's idea deck. Answer with a short exploration: a one-line hook, then 2-4 directions to take this idea, in an <ideas> block of <idea title="..."> tags.

Build the directions from the twists below. Pick the ones that fit this household best. Adapt them lightly where that helps: move a twist to a neighbouring cuisine the household cooks (Chinese to Japanese, Spanish to Portuguese), swap out anything they avoid, lean on what their shops carry. Never offer two directions that are near-duplicates. Do not write a Sketch yet.

Twists:
${twists.map((t) => `- ${t.title} (${t.cuisine}): ${t.pitch}`).join("\n")}`;
}
