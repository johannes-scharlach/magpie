import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { roundedHeader } from "@/components/clay";

export default function HouseholdLayout() {
  const reduced = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        ...roundedHeader,
        animation: reduced ? "fade" : "default",
        headerBackButtonDisplayMode: "minimal",
        ...(Platform.OS === "android" ? { sheetCornerRadius: 28 } : {}),
      }}
    >
      {/* The header lives on the root stack's "household" screen: only there
          does the system back chevron have somewhere to go. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="invite"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[section]"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="switch"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="person"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.85, 1],
          sheetGrabberVisible: true,
          headerShown: Platform.OS === "ios",
          headerTransparent: false,
        }}
      />
    </Stack>
  );
}
