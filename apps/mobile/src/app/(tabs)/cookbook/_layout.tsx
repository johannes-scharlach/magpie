import { Stack } from "expo-router";
import { useIntl } from "react-intl";

import { roundedHeader } from "@/components/clay";

export default function CookbookLayout() {
  const intl = useIntl();
  return (
    <Stack screenOptions={roundedHeader}>
      <Stack.Screen
        name="index"
        options={{
          title: intl.formatMessage({
            defaultMessage: "Cookbook",
            description:
              "Title of the Cookbook tab, which holds the household's saved recipes.",
          }),
          headerLargeTitle: true,
        }}
      />
    </Stack>
  );
}
