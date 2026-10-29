import twists from "@magpie/meals/seeded-twists.json";

import type { Dinner } from "./game";

/** Editorial estimates and qualities, not stock, household tastes or cooking history.
 *  Use concrete directions, not their near-duplicate parent ideas. */
export const dinners: readonly Dinner[] = Object.values(twists).flatMap(
  (directions) =>
    directions.map((idea) => {
      const { name, activeMinutes, totalMinutes, ...qualities } = idea.dinner;
      return {
        title: idea.title,
        name,
        pitch: idea.pitch,
        activeMinutes,
        totalMinutes,
        qualities,
      };
    }),
);
