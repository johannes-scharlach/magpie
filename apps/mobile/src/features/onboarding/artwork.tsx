import { Image } from "expo-image";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import type { CookingProfile } from "@magpie/profile";
import {
  equipmentOptions,
  freshOptions,
  ingredientOptions,
  pantryOptions,
} from "@magpie/profile";

// Every ID has a production brief in art/README.md. Ship the transparent WebP
// exports from pnpm assets:optimize, not the PNG masters; missing art gets a placeholder.
export type ArtworkId =
  | "welcome-market-find"
  | `equipment-${keyof typeof equipmentOptions}`
  | `pantry-${keyof typeof pantryOptions}`
  | `fresh-${keyof typeof freshOptions}`
  | `ingredient-${keyof typeof ingredientOptions}`;

const deliveredAssets: Partial<Record<ArtworkId, number>> = {
  "welcome-market-find": require("./art/optimized/welcome-market-find.webp"),
  "equipment-oven": require("./art/optimized/equipment-oven.webp"),
  "equipment-stove": require("./art/optimized/equipment-stove.webp"),
  "equipment-microwave": require("./art/optimized/equipment-microwave.webp"),
  "equipment-slow-cooker": require("./art/optimized/equipment-slow-cooker.webp"),
  "equipment-air-fryer": require("./art/optimized/equipment-air-fryer.webp"),
  "equipment-blender": require("./art/optimized/equipment-blender.webp"),
  "equipment-food-processor": require("./art/optimized/equipment-food-processor.webp"),
  "equipment-rice-cooker": require("./art/optimized/equipment-rice-cooker.webp"),
  "pantry-pasta": require("./art/optimized/pantry-pasta.webp"),
  "pantry-rice": require("./art/optimized/pantry-rice.webp"),
  "pantry-canned-tomatoes": require("./art/optimized/pantry-canned-tomatoes.webp"),
  "pantry-noodles": require("./art/optimized/pantry-noodles.webp"),
  "pantry-canned-corn": require("./art/optimized/pantry-canned-corn.webp"),
  "pantry-canned-tuna": require("./art/optimized/pantry-canned-tuna.webp"),
  "pantry-chickpeas": require("./art/optimized/pantry-chickpeas.webp"),
  "pantry-lentils": require("./art/optimized/pantry-lentils.webp"),
  "pantry-canned-beans": require("./art/optimized/pantry-canned-beans.webp"),
  "pantry-olive-oil": require("./art/optimized/pantry-olive-oil.webp"),
  "pantry-soy-sauce": require("./art/optimized/pantry-soy-sauce.webp"),
  "pantry-vinegar": require("./art/optimized/pantry-vinegar.webp"),
  "pantry-peanut-butter": require("./art/optimized/pantry-peanut-butter.webp"),
  "pantry-oats": require("./art/optimized/pantry-oats.webp"),
  "pantry-flour": require("./art/optimized/pantry-flour.webp"),
  "pantry-coconut-milk": require("./art/optimized/pantry-coconut-milk.webp"),
  "pantry-honey": require("./art/optimized/pantry-honey.webp"),
  "pantry-sugar": require("./art/optimized/pantry-sugar.webp"),
  "pantry-stock": require("./art/optimized/pantry-stock.webp"),
  "pantry-spices": require("./art/optimized/pantry-spices.webp"),
  "fresh-eggs": require("./art/optimized/fresh-eggs.webp"),
  "fresh-milk": require("./art/optimized/fresh-milk.webp"),
  "fresh-butter": require("./art/optimized/fresh-butter.webp"),
  "fresh-cheese": require("./art/optimized/fresh-cheese.webp"),
  "fresh-greek-yoghurt": require("./art/optimized/fresh-greek-yoghurt.webp"),
  "fresh-plain-yoghurt": require("./art/optimized/fresh-plain-yoghurt.webp"),
  "fresh-cream": require("./art/optimized/fresh-cream.webp"),
  "ingredient-soy-sauce": require("./art/optimized/pantry-soy-sauce.webp"),
  "ingredient-canned-corn": require("./art/optimized/pantry-canned-corn.webp"),
  "ingredient-canned-tuna": require("./art/optimized/pantry-canned-tuna.webp"),
  "ingredient-chickpeas": require("./art/optimized/pantry-chickpeas.webp"),
  "ingredient-lentils": require("./art/optimized/pantry-lentils.webp"),
  "ingredient-canned-beans": require("./art/optimized/pantry-canned-beans.webp"),
  "ingredient-peanut-butter": require("./art/optimized/pantry-peanut-butter.webp"),
  "ingredient-noodles": require("./art/optimized/pantry-noodles.webp"),
  "ingredient-oats": require("./art/optimized/pantry-oats.webp"),
  "ingredient-coconut-milk": require("./art/optimized/pantry-coconut-milk.webp"),
};

export function Artwork({
  id,
  hero = false,
}: {
  id: ArtworkId;
  hero?: boolean;
}) {
  const asset = deliveredAssets[id];
  if (asset) {
    return (
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        className="items-center justify-center overflow-hidden"
        style={{ aspectRatio: hero ? 1.5 : 1, width: "100%" }}
      >
        <Image
          source={asset}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
        />
      </View>
    );
  }
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/50 px-2"
      style={{
        aspectRatio: hero ? 1.5 : 1,
        width: "100%",
        borderCurve: "continuous",
      }}
    >
      <Text
        className={
          hero
            ? "text-center text-sm text-muted-foreground"
            : "text-center text-[10px] leading-3.5 text-muted-foreground"
        }
      >
        {id}
      </Text>
    </View>
  );
}

/** Recognition at signup: the user's actual selections, rather than a summary to read. */
export function KitchenArtwork({ profile }: { profile: CookingProfile }) {
  const ids: ArtworkId[] = [
    ...profile.keeps
      .filter((id) => id in ingredientOptions)
      .slice(0, 3)
      .map((id) => `ingredient-${id}` as ArtworkId),
    ...Object.keys(equipmentOptions)
      .filter((key) => profile.kitchen_equipment[key] === true)
      .slice(0, 1)
      .map((key) => `equipment-${key}` as ArtworkId),
  ].slice(0, 4);
  if (!ids.length) return null;
  return (
    <View
      className="flex-row items-center gap-2"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Your selected kitchen equipment and ingredients"
    >
      {ids.map((id) => (
        <View className="flex-1" key={id}>
          <Artwork id={id} />
        </View>
      ))}
    </View>
  );
}
