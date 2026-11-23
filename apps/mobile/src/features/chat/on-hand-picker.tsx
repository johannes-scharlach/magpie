import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { defineMessages, useIntl } from "react-intl";
import { ScrollView, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { ClayPebble, PressableScale, clayTile } from "@/components/clay";
import { Text } from "@/components/ui/text";
import { useIngredientArt } from "@/features/ingredients/ingredient-art";
import { formatPickerIngredient } from "@/features/ingredients/ingredient-labels";
import { useHousehold } from "@/features/profile/use-household";
import { cn } from "@/lib/utils";

import {
  ingredientPickerSections,
  type PickedIngredient,
} from "./ingredient-picker";

const sectionLabels = defineMessages({
  useUp: {
    defaultMessage: "Use up first",
    description:
      "Ingredient picker heading for likely remainders to use soon. These are suggestions, not confirmed stock.",
  },
  staples: {
    defaultMessage: "Staples",
    description:
      "Ingredient picker heading for common meal bases such as rice and pasta.",
  },
  cupboard: {
    defaultMessage: "Your cupboard",
    description:
      "Ingredient picker heading for foods the household says it usually keeps. Includes refrigerator and freezer picks.",
  },
  picked: {
    defaultMessage: "Still selected",
    description:
      "Ingredient picker heading for choices that remain in the draft after their suggestions changed.",
  },
});

export function OnHandPicker({
  listId,
  useUp,
  picked,
  onToggle,
}: {
  listId: string | null;
  /** Ranked labels for this slot. Subsequent results can replace them while drafting. */
  useUp?: readonly string[];
  picked: readonly PickedIngredient[];
  onToggle: (tile: PickedIngredient) => void;
}) {
  const intl = useIntl();
  const { household } = useHousehold(listId);
  const sections = ingredientPickerSections({
    useUp,
    profile: household?.profile,
    picked,
  });
  const artFor = useIngredientArt(
    sections.flatMap(({ tiles }) => tiles.map(({ label }) => label)),
  );
  const selectionColor = useResolveClassNames("text-primary").color;

  // One compact scrolling row shares the composer's keyboard-sticky region.
  // A tile press is for selecting, never for dismissing the keyboard.
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      className="grow-0 bg-background"
      contentContainerClassName="gap-4 px-4 pb-2"
    >
      {sections.map(({ id, tiles }) => (
        <View key={id} className="gap-1.5">
          <Text
            accessibilityRole="header"
            className="font-rounded font-extrabold text-primary"
          >
            {intl.formatMessage(sectionLabels[id])}
          </Text>
          <View className="flex-row gap-2">
            {tiles.map((tile) => {
              const selected = picked.some(({ key }) => key === tile.key);
              const asset = artFor(tile.label);
              const label = formatPickerIngredient(intl, tile.label);
              return (
                <PressableScale
                  key={tile.key}
                  accessibilityRole="checkbox"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: selected }}
                  onPress={() => onToggle(tile)}
                  className="w-24"
                >
                  <View
                    className={cn(
                      "min-h-24 items-center justify-center border px-1.5 py-1.5",
                      selected
                        ? "border-primary bg-accent"
                        : "border-transparent bg-secondary",
                    )}
                    style={clayTile}
                  >
                    {asset !== undefined ? (
                      <View
                        className="h-13 w-17"
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        <ClayPebble seed={tile.key} />
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
                      className="text-center font-rounded text-sm font-bold"
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
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
