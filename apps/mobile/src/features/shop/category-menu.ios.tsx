import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import { SymbolView } from "expo-symbols";
import { View } from "react-native";
import { useIntl } from "react-intl";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";

import { formatCategory } from "./category-labels";
import type { CategoryMenuProps } from "./category-menu";

const CHEVRON_ICON = {
  ios: "chevron.up.chevron.down",
  android: "unfold_more",
} as const;

/** iOS: native menu with checkmark state. */
export function CategoryMenu({
  categories,
  categoryId,
  categoryName,
  onSelect,
}: CategoryMenuProps) {
  const intl = useIntl();
  const mutedColor = useResolveClassNames("text-muted-foreground").color;

  return (
    <MenuView
      onPressAction={({ nativeEvent: { event } }) => {
        onSelect(event === "uncategorised" ? null : event);
      }}
      actions={[
        {
          id: "uncategorised",
          title: intl.formatMessage({
            defaultMessage: "Uncategorised",
            description:
              "Menu option that clears a shopping item's category, so it sits outside the category headings.",
          }),
          state: (!categoryId ? "on" : "off") as MenuAction["state"],
        },
        ...categories.map((cat) => ({
          id: cat.id,
          title: formatCategory(intl, cat.id, cat.name) ?? cat.name ?? "",
          state: (categoryId === cat.id ? "on" : "off") as MenuAction["state"],
        })),
      ]}
    >
      <View
        accessible
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
      </View>
    </MenuView>
  );
}
