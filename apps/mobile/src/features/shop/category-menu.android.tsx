import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useIntl } from "react-intl";
import { useResolveClassNames } from "uniwind";

import {
  AndroidMenuOverlay,
  type AndroidMenuAnchor,
} from "@/components/ui/android-menu-overlay";
import { Text } from "@/components/ui/text";

import { formatCategory } from "./category-labels";
import type { CategoryMenuProps } from "./category-menu";

const CHEVRON_ICON = {
  ios: "chevron.up.chevron.down",
  android: "unfold_more",
} as const;

/** Android: row button opening the shared overlay, checkmark on selected. */
export function CategoryMenu({
  categories,
  categoryId,
  categoryName,
  onSelect,
}: CategoryMenuProps) {
  const intl = useIntl();
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const [anchor, setAnchor] = useState<AndroidMenuAnchor | null>(null);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={intl.formatMessage(
          {
            defaultMessage: "Category: {name}",
            description:
              "Accessibility label for the menu that sets a shopping item's category. {name} is the current category, or Uncategorised.",
          },
          {
            name:
              categoryName ??
              intl.formatMessage({
                defaultMessage: "Uncategorised",
                description:
                  "Fallback for a shopping item that has no category.",
              }),
          },
        )}
        onPress={(e) => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
          setAnchor({
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          });
        }}
        className="min-h-12 flex-row items-center gap-2 px-4 py-3 active:bg-accent"
      >
        <Text className="flex-1 text-base">
          {intl.formatMessage({
            defaultMessage: "Category",
            description:
              "Label of the row that sets a shopping item's category.",
          })}
        </Text>
        <Text variant="muted" className="text-base">
          {formatCategory(intl, categoryId, categoryName) ??
            intl.formatMessage({
              defaultMessage: "Uncategorised",
              description: "Fallback for a shopping item that has no category.",
            })}
        </Text>
        <SymbolView name={CHEVRON_ICON} tintColor={mutedColor} size={16} />
      </Pressable>
      <AndroidMenuOverlay
        anchor={anchor}
        onDismiss={() => setAnchor(null)}
        actions={[
          {
            id: "uncategorised",
            title: intl.formatMessage({
              defaultMessage: "Uncategorised",
              description:
                "Menu option that clears a shopping item's category, so it sits outside the category headings.",
            }),
            selected: !categoryId,
            onSelect: () => onSelect(null),
          },
          ...categories.map((cat) => ({
            id: cat.id,
            title: formatCategory(intl, cat.id, cat.name) ?? cat.name ?? "",
            selected: categoryId === cat.id,
            onSelect: () => onSelect(cat.id),
          })),
        ]}
      />
    </View>
  );
}
