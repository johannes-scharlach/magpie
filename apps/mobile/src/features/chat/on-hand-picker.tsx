import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useEffect, useEffectEvent, useState } from "react";
import { defineMessages, useIntl } from "react-intl";
import { Pressable, ScrollView, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { ClayPebble, PressableScale } from "@/components/clay";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useIngredientArt } from "@/features/ingredients/ingredient-art";
import { formatPickerIngredient } from "@/features/ingredients/ingredient-labels";
import { logUseUp } from "@/features/meals/use-up-debug";
import { useHousehold } from "@/features/profile/use-household";
import { cn } from "@/lib/utils";

import {
  onHandIngredientChoices,
  SUGGESTED_INGREDIENT_LIMIT,
  type PickedIngredient,
} from "./ingredient-picker";

const SUGGESTION_WAIT_MS = 5000;
const gridCell = "min-h-28 w-1/3 items-center px-1.5 py-2";
const row =
  "min-h-12 flex-row items-center gap-2.5 border-b border-border/60 py-1.5";

const groupHeadings = defineMessages({
  mealPlan: {
    defaultMessage: "From your meal plan",
    description:
      "Heading for the ranked grid of ingredients suggested from nearby planned meals.",
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
  /** Null while the meal plan is being assessed. */
  useUp: readonly string[] | null;
  picked: readonly PickedIngredient[];
  query: string;
  onToggle: (tile: PickedIngredient) => void;
}) {
  const intl = useIntl();
  const { household, isLoading: profileLoading } = useHousehold(listId);
  const searching = !!query.trim();
  const [showAll, setShowAll] = useState(false);
  const profile = household?.profile;
  const awaitingSuggestions = useUp === null || profileLoading;
  const [fallback, setFallback] = useState<{
    useUp: readonly string[];
    profile: typeof profile;
  } | null>(null);
  const showFallback = useEffectEvent(() => {
    if (!awaitingSuggestions) return;
    logUseUp("picker_fallback", {
      waitMs: SUGGESTION_WAIT_MS,
      assessmentPending: useUp === null,
      profilePending: profileLoading,
    });
    setFallback({ useUp: useUp ?? [], profile });
  });
  useEffect(() => {
    if (!awaitingSuggestions || fallback) return;
    const timer = setTimeout(showFallback, SUGGESTION_WAIT_MS);
    return () => clearTimeout(timer);
  }, [awaitingSuggestions, fallback]);
  // Results that miss the wait window stay cached for the next visit. Once
  // fallback ingredients are visible, a late reply must not replace them.
  const loading = !searching && !fallback && awaitingSuggestions;
  const showMealPlanAction =
    !!fallback &&
    !searching &&
    !awaitingSuggestions &&
    !!useUp?.length &&
    fallback.useUp !== useUp;
  const displayLabel = (label: string) => formatPickerIngredient(intl, label);
  const ingredients = !searching && fallback ? fallback : { useUp, profile };
  const { featured, moreFromMealPlan, other } = onHandIngredientChoices({
    useUp: ingredients.useUp ?? undefined,
    profile: ingredients.profile,
    query,
    displayLabel,
    locale: intl.locale,
  });
  const canExpand = !loading && moreFromMealPlan.length > 0;
  const grid =
    canExpand && showAll ? [...featured, ...moreFromMealPlan] : featured;
  const selectedKeys = new Set(picked.map(({ key }) => key));
  const artFor = useIngredientArt(
    [...grid, ...other].map(({ label }) => label),
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
        className={cn(illustrated ? gridCell : row, "active:opacity-60")}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected }}
        onPress={() => onToggle(tile)}
      >
        {illustrated ? (
          <View className="h-12 w-16 justify-center">{art}</View>
        ) : (
          <View className="h-8 w-10 justify-center">{art}</View>
        )}
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

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="always"
      className="flex-1"
      contentContainerClassName="px-4 pb-4"
    >
      {loading || showMealPlanAction || grid.length > 0 ? (
        <View className="pb-3 pt-2">
          <View className="min-h-11 flex-row items-center justify-between gap-2">
            <Text
              accessibilityRole="header"
              accessibilityState={{ busy: loading }}
              className="flex-1 font-rounded font-extrabold text-primary"
            >
              {intl.formatMessage(groupHeadings.mealPlan)}
            </Text>
            {showMealPlanAction ? (
              <Pressable
                accessibilityRole="button"
                className="min-h-11 max-w-1/2 justify-center active:opacity-60"
                onPress={() => setFallback(null)}
              >
                <Text className="text-end text-sm font-semibold text-primary">
                  {intl.formatMessage({
                    defaultMessage: "Show meal plan suggestions",
                    description:
                      "Action in the ingredient picker that reveals suggestions from the meal plan after they finish loading.",
                  })}
                </Text>
              </Pressable>
            ) : canExpand ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showAll }}
                className="min-h-11 justify-center active:opacity-60"
                onPress={() => setShowAll((shown) => !shown)}
              >
                <Text className="text-sm font-semibold text-primary">
                  {showAll
                    ? intl.formatMessage({
                        defaultMessage: "Show less",
                        description:
                          "Collapses the additional ranked meal-plan ingredients in the ingredient picker.",
                      })
                    : intl.formatMessage({
                        defaultMessage: "Show more",
                        description:
                          "Expands the additional ranked meal-plan ingredients in the ingredient picker.",
                      })}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {loading ? (
            <Skeleton
              className="flex-row flex-wrap bg-transparent pt-1 dark:bg-transparent"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {Array.from(
                { length: SUGGESTED_INGREDIENT_LIMIT },
                (_, index) => (
                  <View key={index} className={gridCell}>
                    <View className="h-12 w-14 rounded-2xl bg-secondary dark:bg-muted" />
                    <View className="mt-1.5 h-3 w-14 rounded-full bg-secondary dark:bg-muted" />
                  </View>
                ),
              )}
            </Skeleton>
          ) : grid.length > 0 ? (
            <View className="flex-row flex-wrap pt-1">
              {grid.map((tile) => choice(tile, true))}
            </View>
          ) : null}
        </View>
      ) : null}
      {!searching && (loading || other.length > 0) ? (
        <Text
          accessibilityRole="header"
          className="pb-1 pt-2 font-rounded font-extrabold text-primary"
        >
          {intl.formatMessage(groupHeadings.cupboard)}
        </Text>
      ) : null}
      {searching && !other.length ? (
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
      {loading ? (
        <Skeleton
          className="bg-transparent dark:bg-transparent"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {[0, 1, 2, 3].map((index) => (
            <View key={index} className={row}>
              <View className="h-8 w-10 rounded-xl bg-secondary dark:bg-muted" />
              <View className="h-3 w-28 rounded-full bg-secondary dark:bg-muted" />
            </View>
          ))}
        </Skeleton>
      ) : (
        other.map((tile) => choice(tile, false))
      )}
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
