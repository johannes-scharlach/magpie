import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";

import { SEEDED_ART } from "@/features/chat/seeded-art";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { env } from "@/lib/env";

import { seededLook } from "./seeded-look";

export const RECIPE_LIST_TILE_SIZE = 72;

/** The cookbook row tile. Leave room above it for the dish to spill. */
export function RecipeListArt({
  id,
  name,
  artPath,
}: {
  id: string;
  name: string | null;
  artPath?: string | null;
}) {
  const dark = useColorScheme() === "dark";
  return (
    <View
      style={{ width: RECIPE_LIST_TILE_SIZE, height: RECIPE_LIST_TILE_SIZE }}
    >
      <LinearGradient
        colors={tonalPair(id, dark)}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ flex: 1, borderRadius: 18, borderCurve: "continuous" }}
      />
      <RecipeArt
        name={name}
        artPath={artPath}
        inset={{ top: -12, right: -6, bottom: 4, left: -6 }}
      />
    </View>
  );
}

/** A recipe's clay art over its gradient (ADR 38): a seeded dish's bundled
 *  art, else the art drawn for the recipe, else nothing until it arrives.
 *  Place inside the gradient's positioned container. Negative insets let
 *  the dish spill over the tile's edge. */
export function RecipeArt({
  name,
  artPath,
  inset,
}: {
  name: string | null;
  artPath?: string | null;
  inset: number | { top: number; right: number; bottom: number; left: number };
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
      style={[
        { position: "absolute" },
        typeof inset === "number" ? { inset } : inset,
      ]}
    />
  );
}
