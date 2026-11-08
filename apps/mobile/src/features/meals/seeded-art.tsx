import { Image } from "expo-image";

import { SEEDED_ART } from "@/features/chat/seeded-art";

import { seededLook } from "./seeded-look";

/** Seeded recipes' clay art over their gradient; nothing for the household's own.
 *  Place inside the gradient's positioned container. */
export function SeededArt({
  name,
  inset,
}: {
  name: string | null;
  inset: number;
}) {
  const look = name ? seededLook(name) : null;
  if (!look) return null;
  return (
    <Image
      source={SEEDED_ART[look.idea]}
      contentFit="contain"
      accessible={false}
      accessibilityIgnoresInvertColors
      style={{ position: "absolute", inset }}
    />
  );
}
