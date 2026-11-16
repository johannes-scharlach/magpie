import { MenuView } from "@expo/ui/community/menu";
import { SymbolView } from "expo-symbols";
import { useIntl } from "react-intl";
import { View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { mealCardMenuMessages } from "./meal-card-menu-messages";
import type { MealCardMenuProps } from "./meal-card-menu";

const MENU_ICON = {
  ios: "ellipsis",
  android: "more_horiz",
} as const;

/** iOS: native menu. The card itself stays in meal-section.tsx. */
export function MealCardMenu({
  recipeId,
  recipeName,
  eatersLabel,
  onEditEaters,
  onChange,
  onMove,
  onRepeat,
  onSkip,
}: MealCardMenuProps) {
  const intl = useIntl();
  const muted = useResolveClassNames("text-muted-foreground").color;

  return (
    <MenuView
      key={recipeId}
      style={{ position: "absolute", right: 6, top: 6 }}
      actions={[
        {
          id: "repeat",
          title: intl.formatMessage(mealCardMenuMessages.planAgain),
          image: "calendar.badge.plus",
        },
        {
          id: "eaters",
          title: eatersLabel,
          image: "person.2",
        },
        {
          id: "change",
          title: intl.formatMessage(mealCardMenuMessages.chooseAnother),
          image: "arrow.triangle.2.circlepath",
        },
        {
          id: "move",
          title: intl.formatMessage(mealCardMenuMessages.move),
          image: "arrow.right",
        },
        {
          id: "remove-section",
          title: "",
          displayInline: true,
          subactions: [
            {
              id: "remove",
              title: intl.formatMessage(mealCardMenuMessages.remove),
              image: "calendar.badge.minus",
              attributes: { destructive: true },
            },
          ],
        },
      ]}
      onPressAction={({ nativeEvent: { event } }) => {
        if (event === "repeat") onRepeat();
        else if (event === "eaters") onEditEaters();
        else if (event === "change") onChange();
        else if (event === "move") onMove();
        else if (event === "remove") onSkip();
      }}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={intl.formatMessage(
          {
            defaultMessage: "Actions for {recipe}",
            description:
              "Accessibility label for the menu on a planned meal card.",
          },
          { recipe: recipeName },
        )}
        style={{
          width: 48,
          height: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View className="h-8 w-8 items-center justify-center rounded-full bg-card/80">
          <SymbolView name={MENU_ICON} tintColor={muted} size={16} />
        </View>
      </View>
    </MenuView>
  );
}
