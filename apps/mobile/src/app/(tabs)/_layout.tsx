import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useIntl } from "react-intl";
import { useResolveClassNames } from "uniwind";

import { useAuth } from "@/db/provider";

export default function TabsLayout() {
  const { session, ready } = useAuth();
  const intl = useIntl();
  const tintColor = useResolveClassNames("bg-primary").backgroundColor;
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const backgroundColor = useResolveClassNames("bg-background").backgroundColor;
  const indicatorColor = useResolveClassNames("bg-accent").backgroundColor;

  if (!ready) return null;
  if (!session) return <Redirect href="/sign-in" />;

  return (
    <NativeTabs
      tintColor={tintColor}
      iconColor={{ default: mutedColor, selected: tintColor }}
      labelStyle={{
        default: { color: mutedColor },
        selected: { color: tintColor },
      }}
      backgroundColor={backgroundColor}
      indicatorColor={indicatorColor}
      rippleColor={indicatorColor}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="(meals)">
        <NativeTabs.Trigger.Label>
          {intl.formatMessage({
            defaultMessage: "Meals",
            description: "Label for the primary meal planning tab.",
          })}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="fork.knife" md="restaurant" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="shop">
        <NativeTabs.Trigger.Label>
          {intl.formatMessage({
            defaultMessage: "Shop",
            description:
              "Label for the tab with the household's shopping list.",
          })}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="cart.fill" md="shopping_cart" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="cookbook">
        <NativeTabs.Trigger.Label>
          {intl.formatMessage({
            defaultMessage: "Cookbook",
            description:
              "Label for the tab with the household's saved recipes.",
          })}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="book.fill" md="menu_book" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
