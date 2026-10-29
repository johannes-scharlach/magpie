import twists from "@magpie/meals/seeded-twists.json";
import { Image } from "expo-image";

import { SEEDED_ART } from "@/features/chat/seeded-art";
import seeds from "@/features/chat/seeded-ideas.json";

import type { Dinner } from "./game";

const ART = Object.fromEntries([
  ...seeds.map((seed) => [seed.title, SEEDED_ART[seed.title]]),
  ...Object.entries(twists).flatMap(([family, ideas]) =>
    ideas.map((idea) => [idea.title, SEEDED_ART[family]]),
  ),
]);

export function DinnerFood({
  dinner,
  width,
  height,
}: {
  dinner: Dinner;
  width: number;
  height: number;
}) {
  return (
    <Image
      source={ART[dinner.title]}
      contentFit="contain"
      accessible={false}
      accessibilityIgnoresInvertColors
      style={{ width, height }}
    />
  );
}
