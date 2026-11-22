import { Stack } from "expo-router";

import { roundedHeader } from "@/components/clay";

// This group's index serves "/" so Meals is the default tab.
export default function MealsLayout() {
  return <Stack screenOptions={roundedHeader} />;
}
