import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable } from "react-native";

import { Text } from "@/components/ui/text";
import { DinnerReels } from "@/features/dinner-reels/dinner-reels";
import { DinnerTurntable } from "@/features/dinner-turntable/dinner-turntable";

/** Two games on trial; the header switches between them. */
export default function DinnerTurntableRoute() {
  const [game, setGame] = useState<"reels" | "turntable">("reels");
  const other = game === "reels" ? "Turntable" : "Reels";
  return (
    <>
      {game === "reels" ? <DinnerReels /> : <DinnerTurntable />}
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() =>
                setGame((current) =>
                  current === "reels" ? "turntable" : "reels",
                )
              }
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${other}`}
              className="px-2 py-1"
            >
              <Text className="font-rounded font-bold text-link">{other}</Text>
            </Pressable>
          ),
        }}
      />
    </>
  );
}
