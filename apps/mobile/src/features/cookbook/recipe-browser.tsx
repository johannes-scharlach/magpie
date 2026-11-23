import { Link, Stack, router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { defineMessages, useIntl } from "react-intl";
import { useResolveClassNames } from "uniwind";
import { Text } from "@/components/ui/text";
import type { Variant } from "@/db/schema";
import { formatEffort } from "@/features/meals/effort-label";
import { RecipeArt } from "@/features/meals/recipe-art";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { MealSlot } from "@/features/meals/slots";
import { importRecipeAction } from "./messages";
import { useRecipeChoices } from "./use-recipe-choices";

const EMPTY_COOKBOOK_ICON = require("../../../assets/images/spot/empty-cookbook.webp");

const recipeActionMessages = defineMessages<{
  plan: { name: string };
  open: { name: string };
}>(
  {
    plan: {
      defaultMessage: "Plan {name}",
      description:
        "Accessibility label for a cookbook recipe that fills the meal slot being planned. {name} is the recipe's name. Selecting it plans the recipe.",
    },
    open: {
      defaultMessage: "Open {name}",
      description:
        "Accessibility label for a cookbook recipe. {name} is the recipe's name. Selecting it opens the recipe.",
    },
  },
  { typed: true },
);

/** Shared browsing rules and native search for the cookbook and slot picker. */
export function RecipeBrowser({
  onSelect,
  disabled,
  target,
  error,
  header,
  onImport,
}: {
  onSelect?: (variant: Variant) => void;
  disabled?: boolean;
  target?: { date: string; slot: MealSlot };
  error?: string | null;
  /** Above the list, such as imports still on their way. */
  header?: ReactNode;
  onImport: () => void;
}) {
  const intl = useIntl();
  const [search, setSearch] = useState("");
  const { choices, isLoading } = useRecipeChoices(search);
  const dark = useColorScheme() === "dark";
  const foreground = useResolveClassNames("text-foreground").color;
  const muted = useResolveClassNames("text-muted-foreground").color;
  return (
    <>
      <Stack.SearchBar
        placeholder={intl.formatMessage({
          defaultMessage: "Search recipes",
          description: "Placeholder in the cookbook's search field.",
        })}
        tintColor={foreground}
        headerIconColor={foreground}
        textColor={foreground}
        hintTextColor={muted}
        autoCapitalize="none"
        hideWhenScrolling
        onChangeText={(event) => setSearch(event.nativeEvent.text)}
        onCancelButtonPress={() => setSearch("")}
      />
      <FlatList
        className="flex-1 bg-background"
        data={choices}
        keyExtractor={({ variant }) => variant.recipe_id!}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {header}
            {error ? (
              <Text className="p-6 text-destructive">{error}</Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator className="mt-12" />
          ) : (
            <View className="items-center gap-4 px-6 py-12">
              {!search.trim() ? (
                <Image
                  source={EMPTY_COOKBOOK_ICON}
                  contentFit="contain"
                  style={{ width: 140, height: 140 }}
                  accessibilityLabel={intl.formatMessage({
                    defaultMessage: "Empty cookbook",
                    description:
                      "Accessibility label for the illustration shown when the cookbook has no recipes.",
                  })}
                />
              ) : null}
              <Text variant="muted" className="text-center">
                {search.trim()
                  ? intl.formatMessage(
                      {
                        defaultMessage: "No matches for “{query}”.",
                        description:
                          "Empty search result in the cookbook. {query} is the cook's own search text, kept as typed.",
                      },
                      { query: search.trim() },
                    )
                  : intl.formatMessage({
                      defaultMessage:
                        "Your cookbook is empty. Import the recipes you love to cook.",
                      description:
                        "Empty cookbook state, before any recipe was saved or imported.",
                    })}
              </Text>
              {!search.trim() ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={onImport}
                  disabled={disabled}
                >
                  <Text className="text-primary">
                    {intl.formatMessage(importRecipeAction)}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        renderItem={({
          item: { cuisine, artPath, variant, olderVariant, variantCount },
        }) => {
          const openVariants = () =>
            router.push({
              pathname: "/variant/versions",
              params: {
                recipeId: variant.recipe_id!,
                id: variant.id,
                ...target,
              },
            });
          const row = (
            <Pressable
              accessibilityRole={target ? "button" : "link"}
              accessibilityLabel={[
                intl.formatMessage(
                  target
                    ? recipeActionMessages.plan
                    : recipeActionMessages.open,
                  { name: variant.name ?? "…" },
                ),
                olderVariant
                  ? intl.formatMessage({
                      defaultMessage: "older matching variant",
                      description:
                        "Added to a cookbook recipe's accessibility label when a newer version matches the same dish. Lowercase so it reads as a continuation.",
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(", ")}
              disabled={disabled}
              onPress={target ? () => onSelect?.(variant) : undefined}
              className="flex-row items-center gap-4 px-6 py-3 active:bg-accent"
            >
              {/* The dish stands on its tile and spills over the top and
                  sides, up to the row's edge but not over the hairline. */}
              <View className="size-[72px]">
                <LinearGradient
                  colors={tonalPair(variant.id, dark)}
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.85, y: 1 }}
                  style={{
                    flex: 1,
                    borderRadius: 18,
                    borderCurve: "continuous",
                  }}
                />
                <RecipeArt
                  name={variant.name}
                  artPath={artPath}
                  inset={{ top: -12, right: -6, bottom: 4, left: -6 }}
                />
              </View>
              <View className="flex-1 gap-1">
                <Text className="font-medium" numberOfLines={2}>
                  {variant.name ?? "…"}
                </Text>
                <Text variant="muted" className="text-sm" numberOfLines={2}>
                  {[
                    cuisine,
                    formatEffort(intl, variant.effort),
                    variant.total_time,
                  ]
                    .filter(Boolean)
                    .join(" · ") || variant.description}
                </Text>
                {olderVariant ? (
                  <Text className="text-sm text-primary">
                    {intl.formatMessage({
                      defaultMessage: "Older matching variant",
                      description:
                        "Badge on a cookbook recipe when a newer version of the same dish exists.",
                    })}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );

          if (!target) {
            return (
              <View className="border-b border-border/40">
                <Link
                  href={{
                    pathname: "/variant/[id]",
                    params: { id: variant.id },
                  }}
                  asChild
                >
                  <Link.Trigger>{row}</Link.Trigger>
                  <Link.Preview />
                  {variantCount > 1 ? (
                    <Link.Menu>
                      <Link.MenuAction
                        title={intl.formatMessage({
                          defaultMessage: "Other variants",
                          description:
                            "Menu action that opens the other versions of a recipe.",
                        })}
                        icon="square.stack"
                        onPress={openVariants}
                      />
                    </Link.Menu>
                  ) : null}
                </Link>
              </View>
            );
          }

          return (
            <View className="border-b border-border/40">
              {row}
              {variantCount > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={intl.formatMessage(
                    {
                      defaultMessage: "Other variants of {name}",
                      description:
                        "Accessibility label for the row that opens the other versions of a cookbook recipe. {name} is the recipe's name.",
                    },
                    { name: variant.name ?? "…" },
                  )}
                  disabled={disabled}
                  onPress={openVariants}
                  className="self-start px-6 pb-3 pt-1"
                >
                  <Text className="text-sm text-primary">
                    {intl.formatMessage(
                      {
                        defaultMessage:
                          "{count, plural, one {1 other variant} other {# other variants}}",
                        description:
                          "Row that opens the other versions of a recipe. {count} is how many variants exist.",
                      },
                      { count: variantCount },
                    )}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </>
  );
}
