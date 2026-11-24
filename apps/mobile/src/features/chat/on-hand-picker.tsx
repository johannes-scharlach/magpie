import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { defineMessages, useIntl } from "react-intl";
import { ScrollView, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import {
  ClayPebble,
  IngredientTileSurface,
  PressableScale,
} from "@/components/clay";
import { Text } from "@/components/ui/text";
import { useIngredientArt } from "@/features/ingredients/ingredient-art";
import { formatPickerIngredient } from "@/features/ingredients/ingredient-labels";
import { useHousehold } from "@/features/profile/use-household";
import { cn } from "@/lib/utils";

import {
  ingredientPickerSections,
  onHandPickerGroups,
  type PickedIngredient,
} from "./ingredient-picker";

const groupHeadings = defineMessages({
  useUp: {
    defaultMessage: "Use up first",
    description:
      "Ingredient picker heading for likely remainders to use soon. These are suggestions, not confirmed stock.",
  },
  quickPicks: {
    defaultMessage: "Quick picks",
    description:
      "Ingredient picker section for fresh ingredients and staples the household often uses.",
  },
  cupboard: {
    defaultMessage: "More ingredients",
    description:
      "Ingredient picker section for the rest of the household's ingredients, alphabetized by their displayed names.",
  },
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
  const displayLabel = (label: string) => formatPickerIngredient(intl, label);
  const sections = ingredientPickerSections({
    useUp,
    profile: household?.profile,
    freshFirst: true,
    query,
    displayLabel,
  });
  const selectedKeys = new Set(picked.map(({ key }) => key));
  const searching = !!query.trim();
  const grid = onHandPickerGroups(
    sections,
    query,
    displayLabel,
    intl.locale,
  ).flatMap(({ id, tiles }) => (id === "matches" ? tiles : [id, ...tiles]));
  const artFor = useIngredientArt(
    grid.flatMap((tile) => (typeof tile === "string" ? [] : [tile.label])),
  );
  const selectionColor = useResolveClassNames("text-primary").color;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="always"
      className="flex-1"
      contentContainerClassName="flex-row flex-wrap gap-y-2 px-3 pb-4 pt-2"
    >
      {!searching ? (
        <Text
          accessibilityRole="header"
          className="w-full px-1 pb-1 font-rounded text-lg font-extrabold"
        >
          {intl.formatMessage({
            defaultMessage: "What do you want to cook with?",
            description:
              "Heading above the ingredient picker for a planned meal. Invites the cook to choose ingredients they want to cook with.",
          })}
        </Text>
      ) : null}
      {grid.map((tile) => {
        if (typeof tile === "string")
          return (
            <Text
              key={`heading:${tile}`}
              accessibilityRole="header"
              className="w-full px-1 pt-1 font-rounded font-extrabold text-primary"
            >
              {intl.formatMessage(groupHeadings[tile])}
            </Text>
          );
        const selected = selectedKeys.has(tile.key);
        const asset = artFor(tile.label);
        const label = formatPickerIngredient(intl, tile.label);
        return (
          <Animated.View
            key={`tile:${tile.key}`}
            layout={reducedMotion || searching ? undefined : TILE_MOVE}
            className="px-1"
            style={{
              width: fontScale > 1.35 || width < 350 ? "50%" : "33.3333%",
            }}
          >
            <PressableScale
              stretch
              accessibilityRole="checkbox"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected }}
              onPress={() => onToggle(tile)}
            >
              <IngredientTileSurface className="min-h-22 grow items-center justify-center gap-1 px-2 py-1">
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
                    className="absolute end-2 top-1.5"
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
              </IngredientTileSurface>
            </PressableScale>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

export function PickedIngredients({
  picked,
  onRemove,
}: {
  picked: readonly PickedIngredient[];
  onRemove: (tile: PickedIngredient) => void;
}) {
  const intl = useIntl();
  const color = useResolveClassNames("text-primary").color;
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      contentContainerClassName="items-center gap-2 px-4"
      showsHorizontalScrollIndicator={false}
      className="grow-0"
    >
      {[...picked].reverse().map((tile) => {
        const label = formatPickerIngredient(intl, tile.label);
        return (
          <PressableScale
            key={tile.key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: true }}
            accessibilityLabel={label}
            onPress={() => onRemove(tile)}
          >
            <View className="min-h-11 justify-center">
              <View className="max-w-64 flex-row items-center gap-2 rounded-full bg-accent px-3 py-1.5">
                <Text
                  numberOfLines={1}
                  className="shrink font-rounded text-sm font-bold text-primary"
                >
                  {label}
                </Text>
                <SymbolView
                  name={{ ios: "xmark", android: "close" }}
                  tintColor={color}
                  size={12}
                />
              </View>
            </View>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}
