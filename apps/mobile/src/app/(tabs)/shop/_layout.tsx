import { Stack } from "expo-router";
import { useIntl } from "react-intl";

import { roundedHeader } from "@/components/clay";

export default function ShopLayout() {
  const intl = useIntl();
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
          headerLargeTitle: true,
        }}
      />
    </Stack>
  );
}
