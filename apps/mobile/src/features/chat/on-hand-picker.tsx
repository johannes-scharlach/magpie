import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { defineMessages, useIntl } from "react-intl";
import { Pressable, ScrollView, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { ClayPebble, PressableScale } from "@/components/clay";
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
    defaultMessage: "From your meal plan",
    description:
      "Ingredient picker heading for likely ingredients left from earlier planned meals.",
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
  const { household } = useHousehold(listId);
  const [expanded, setExpanded] = useState(false);
  const displayLabel = (label: string) => formatPickerIngredient(intl, label);
  const sections = ingredientPickerSections({
    useUp,
    profile: household?.profile,
    freshFirst: true,
    query,
    displayLabel,
  });
  const selectedKeys = new Set(picked.map(({ key }) => key));
  const groups = onHandPickerGroups(sections, query, displayLabel, intl.locale);
  const artFor = useIngredientArt(
    groups.flatMap(({ tiles }) => tiles.map(({ label }) => label)),
  );
  const selectionColor = useResolveClassNames("text-primary").color;

  function choice(tile: PickedIngredient, illustrated: boolean) {
    const selected = selectedKeys.has(tile.key);
    const label = displayLabel(tile.label);
    const asset = artFor(tile.label);
    const art =
      asset !== undefined ? (
        <View
          className={illustrated ? "h-12 w-16" : "h-8 w-10"}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {illustrated && selected ? <ClayPebble seed={tile.key} /> : null}
          <Image
            source={asset}
            style={{ position: "absolute", width: "100%", height: "100%" }}
            contentFit="contain"
          />
        </View>
      ) : null;
    return (
      <Pressable
        key={tile.key}
        className={
          illustrated
            ? "w-1/3 items-center justify-start px-1.5 py-2 active:opacity-60"
            : "min-h-12 flex-row items-center gap-2.5 border-b border-border/60 py-1.5 active:opacity-60"
        }
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected }}
        onPress={() => onToggle(tile)}
      >
        {illustrated ? <View className="h-12 justify-center">{art}</View> : art}
        <Text
          className={cn(
            "font-rounded font-bold",
            illustrated ? "text-center text-sm" : "flex-1",
            selected && "text-primary",
          )}
        >
          {label}
        </Text>
        {selected ? (
          <View
            className={illustrated ? "absolute end-2 top-2" : "ms-auto"}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <SymbolView
              name={{ ios: "checkmark.circle.fill", android: "check_circle" }}
              tintColor={selectionColor}
              size={18}
            />
          </View>
        ) : null}
      </Pressable>
    );
  }

  // The meal-plan suggestions take precedence, then the household shortcuts.
  // Anything outside the visible row can still be found in the alphabetical list.
  const planned = groups.find(({ id }) => id === "useUp");
  const quick = groups.find(({ id }) => id === "quickPicks");
  const featured = planned ?? quick;
  const visible = featured?.tiles.slice(0, expanded ? undefined : 3) ?? [];
  const visibleKeys = new Set(visible.map(({ key }) => key));
  const other = groups
    .flatMap(({ tiles }) => tiles)
    .filter(({ key }) => !visibleKeys.has(key))
    .sort((a, b) =>
      displayLabel(a.label).localeCompare(displayLabel(b.label), intl.locale),
    );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="always"
      className="flex-1"
      contentContainerClassName="px-4 pb-4"
    >
      {featured ? (
        <View className="pb-3 pt-1">
          <View className="flex-row items-center justify-between gap-2">
            <Text
              accessibilityRole="header"
              className="shrink font-rounded font-extrabold text-primary"
            >
              {intl.formatMessage(
                groupHeadings[planned ? "useUp" : "quickPicks"],
              )}
            </Text>
            {featured.tiles.length > 3 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                className="min-h-11 justify-center px-1 active:opacity-60"
                onPress={() => setExpanded((current) => !current)}
              >
                <Text className="text-sm font-semibold text-primary">
                  {expanded
                    ? intl.formatMessage({
                        defaultMessage: "See fewer",
                        description:
                          "Collapses the illustrated suggestions to a single row in the meal ingredient picker.",
                      })
                    : intl.formatMessage({
                        defaultMessage: "See all",
                        description:
                          "Expands the illustrated suggestions in the meal ingredient picker.",
                      })}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View className="flex-row flex-wrap">
            {visible.map((tile) => choice(tile, true))}
          </View>
        </View>
      ) : null}
      {featured && other.length ? (
        <Text
          accessibilityRole="header"
          className="pb-1 pt-2 font-rounded font-extrabold text-primary"
        >
          {intl.formatMessage(groupHeadings.cupboard)}
        </Text>
      ) : null}
      {query.trim() && !other.length ? (
        <Text
          accessibilityLiveRegion="polite"
          className="py-3 text-sm text-muted-foreground"
        >
          {intl.formatMessage({
            defaultMessage: "No matching ingredients",
            description:
              "Shown below ingredient search when nothing matches. Users can still add the name they typed.",
          })}
        </Text>
      ) : null}
      {other.map((tile) => choice(tile, false))}
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
