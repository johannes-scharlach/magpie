import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { roundedHeader } from "@/components/clay";

export default function SetupLayout() {
  const reduced = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        ...roundedHeader,
        animation: reduced ? "fade" : "default",
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Welcome", headerShown: false }}
      />
      <Stack.Screen
        name="questions"
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="person"
        options={{
          headerShown: Platform.OS === "ios",
          presentation: "formSheet",
          sheetAllowedDetents: [0.85, 1],
          sheetGrabberVisible: true,
          headerTransparent: false,
        }}
      />
      <Stack.Screen
        name="avoidance"
        options={{
          headerShown: Platform.OS === "ios",
          headerTransparent: false,
          presentation: "formSheet",
          sheetAllowedDetents: [0.85, 1],
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen
        name="shop"
        options={{
          title: "Shop",
          presentation: "formSheet",
          sheetAllowedDetents: [0.75, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
          sheetCornerRadius: Platform.OS === "android" ? 28 : undefined,
          headerShown: Platform.OS === "ios",
          headerTransparent: false,
        }}
      />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
    </Stack>
  );
}
