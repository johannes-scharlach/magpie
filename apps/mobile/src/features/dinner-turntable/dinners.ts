import twists from "@magpie/meals/seeded-twists.json";

import seeds from "@/features/chat/seeded-ideas.json";

import type { Dinner, Qualities } from "./game";

type DescribedIdea = {
  title: string;
  dinner: Qualities & {
    name: string;
    activeMinutes: number;
    totalMinutes: number;
  };
};

function dinner(idea: DescribedIdea, pitch: string): Dinner {
  const { name, activeMinutes, totalMinutes, ...qualities } = idea.dinner;
  return {
    title: idea.title,
    name,
    pitch,
    activeMinutes,
    totalMinutes,
    qualities,
  };
}

/** Editorial estimates and qualities, not stock, household tastes or cooking history.
 *  Every source idea participates; no network or household preparation is needed. */
export const dinners: readonly Dinner[] = [
  ...seeds.map((idea) => ({
    ...dinner(idea, idea.vibe),
    ingredients: idea.ingredients,
  })),
  ...Object.values(twists).flatMap((directions) =>
    directions.map((idea) => dinner(idea, idea.pitch)),
  ),
];
