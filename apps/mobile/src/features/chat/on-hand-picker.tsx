import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { defineMessage, useIntl } from "react-intl";
import { ScrollView, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { ClayPebble, PressableScale } from "@/components/clay";
import { Text } from "@/components/ui/text";
import { useIngredientArt } from "@/features/ingredients/ingredient-art";
import { formatPickerIngredient } from "@/features/ingredients/ingredient-labels";
import { useHousehold } from "@/features/profile/use-household";
import { cn } from "@/lib/utils";

import {
  ingredientPickerSections,
  type PickedIngredient,
} from "./ingredient-picker";

const useUpHeading = defineMessage({
  defaultMessage: "Use up first",
  description:
    "Ingredient picker heading for likely remainders to use soon. These are suggestions, not confirmed stock.",
});
const TILE_MOVE = LinearTransition.duration(140)
  .easing(Easing.bezier(0.77, 0, 0.175, 1))
  .reduceMotion(ReduceMotion.System);

export function OnHandPicker({
  listId,
  useUp,
  picked,
  query,
  onToggle,
}: {
  listId: string | null;
  /** Ranked labels for this slot. Subsequent results can replace them while drafting. */
  useUp?: readonly string[];
  picked: readonly PickedIngredient[];
  query: string;
  onToggle: (tile: PickedIngredient) => void;
}) {
  const intl = useIntl();
  const reducedMotion = useReducedMotion();
  const { fontScale, width } = useWindowDimensions();
  const { household } = useHousehold(listId);
  const sections = ingredientPickerSections({
    useUp,
    profile: household?.profile,
    picked,
    query,
    displayLabel: (label) => formatPickerIngredient(intl, label),
  });
  const tiles = sections.flatMap((section) => section.tiles);
  const useUpTiles = query.trim()
    ? undefined
    : sections.find(({ id }) => id === "useUp")?.tiles;
  const selectedKeys = new Set(picked.map(({ key }) => key));
  const unselected = (tile: PickedIngredient) => !selectedKeys.has(tile.key);
  const remainingUseUp = (useUpTiles ?? []).filter(unselected);
  // The same keyed tile stays in this grid when it moves into the selection.
  const grid = [
    ...picked,
    ...(remainingUseUp.length ? [null, ...remainingUseUp] : []),
    ...tiles.slice(useUpTiles?.length ?? 0).filter(unselected),
  ];
  const artFor = useIngredientArt(
    grid.flatMap((tile) => (tile ? [tile.label] : [])),
  );
  const selectionColor = useResolveClassNames("text-primary").color;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="always"
      className="flex-1"
      contentContainerClassName="flex-row flex-wrap items-start gap-2 px-4 py-4"
    >
      {grid.map((tile) => {
        if (!tile)
          return (
            <Text
              key="heading:use-up"
              accessibilityRole="header"
              className="w-full font-rounded font-extrabold text-primary"
            >
              {intl.formatMessage(useUpHeading)}
            </Text>
          );
        const selected = selectedKeys.has(tile.key);
        const asset = artFor(tile.label);
        const label = formatPickerIngredient(intl, tile.label);
        return (
          <Animated.View
            key={`tile:${tile.key}`}
            layout={reducedMotion || query.trim() ? undefined : TILE_MOVE}
            style={{ width: fontScale > 1.35 || width < 350 ? "48%" : "31%" }}
          >
            <PressableScale
              accessibilityRole="checkbox"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected }}
              onPress={() => onToggle(tile)}
            >
              <View className="min-h-24 items-center justify-center px-1.5 py-1.5">
                {asset !== undefined ? (
                  <View
                    className="h-13 w-17"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    {selected ? <ClayPebble seed={tile.key} /> : null}
                    <Image
                      source={asset}
                      style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                      }}
                      contentFit="contain"
                    />
                  </View>
                ) : null}
                <Text
                  className={cn(
                    "text-center font-rounded text-sm font-bold",
                    selected && "text-primary",
                  )}
                  numberOfLines={3}
                >
                  {label}
                </Text>
                {selected ? (
                  <View
                    className="absolute right-1.5 top-1.5"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <SymbolView
                      name={{
                        ios: "checkmark.circle.fill",
                        android: "check_circle",
                      }}
                      tintColor={selectionColor}
                      size={16}
                    />
                  </View>
                ) : null}
              </View>
            </PressableScale>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}
