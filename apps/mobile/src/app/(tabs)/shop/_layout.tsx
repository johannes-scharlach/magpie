import { Stack } from "expo-router";
import { useIntl } from "react-intl";
import { useResolveClassNames } from "uniwind";

import { roundedHeader } from "@/components/clay";

export default function ShopLayout() {
  const intl = useIntl();
  const backgroundColor = useResolveClassNames("bg-background").backgroundColor;
  return (
    <Stack screenOptions={roundedHeader}>
      <Stack.Screen
        name="index"
        options={{
          title: intl.formatMessage({
            defaultMessage: "Shop",
            description:
              "Title of the Shop tab, where the household's shopping list lives.",
          }),
          headerStyle: { backgroundColor },
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}
