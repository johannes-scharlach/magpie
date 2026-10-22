import { Stack } from "expo-router";

import { roundedHeader } from "@/components/clay";

export default function CookbookLayout() {
  return (
    <Stack screenOptions={roundedHeader}>
      <Stack.Screen
        name="index"
        options={{
          title: "Cookbook",
          headerLargeTitle: true,
        }}
      />
    </Stack>
  );
}
