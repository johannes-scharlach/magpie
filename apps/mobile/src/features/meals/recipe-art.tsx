import { Image } from "expo-image";

import { SEEDED_ART } from "@/features/chat/seeded-art";
import { env } from "@/lib/env";

import { seededLook } from "./seeded-look";

/** A recipe's clay art over its gradient (ADR 38): a seeded dish's bundled
 *  art, else the art drawn for the recipe, else nothing until it arrives.
 *  Place inside the gradient's positioned container. */
export function RecipeArt({
  name,
  artPath,
  inset,
}: {
  name: string | null;
  artPath?: string | null;
  inset: number;
}) {
  const look = name ? seededLook(name) : null;
  const source = look
    ? SEEDED_ART[look.idea]
    : artPath
      ? {
          uri: `${env.supabaseUrl}/storage/v1/object/public/recipe-art/${artPath}`,
        }
      : null;
  if (!source) return null;
  return (
    <Image
      source={source}
      contentFit="contain"
      cachePolicy="disk"
      transition={200}
      accessible={false}
      accessibilityIgnoresInvertColors
      style={{ position: "absolute", inset }}
    />
  );
}
