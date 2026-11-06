import { Image } from "expo-image";

import { SEEDED_ART } from "@/features/chat/seeded-art";

import type { Dinner } from "./game";

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
      source={SEEDED_ART[dinner.family]}
      contentFit="contain"
      accessible={false}
      accessibilityIgnoresInvertColors
      style={{ width, height }}
    />
  );
}
