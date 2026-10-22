import { Stack } from "expo-router";

import { roundedHeader } from "@/components/clay";

export default function ShopLayout() {
  return (
    <Stack screenOptions={roundedHeader}>
      <Stack.Screen
        name="index"
        options={{
          title: "Shop",
          headerLargeTitle: true,
        }}
      />
    </Stack>
  );
}
