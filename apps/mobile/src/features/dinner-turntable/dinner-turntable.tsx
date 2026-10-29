import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AccessibilityInfo, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { PressableScale } from "@/components/clay";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cookDinnerMessage } from "@/features/chat/compose";
import { queueMessage } from "@/features/chat/message-queue";
import { useActiveList } from "@/features/onboarding/access";
import { ScrollEdgeFade } from "@/features/onboarding/scroll-edge-fade";

import { ClayWheel, type ClayWheelHandle } from "./clay-wheel";
import { DinnerFood } from "./dinner-food";
import { dinners } from "./dinners";
import { fits, newGame, play, type Action, type Axis, type Game } from "./game";

function updateGame(game: Game, action: Action) {
  return play(dinners, game, action);
}

export function DinnerTurntable() {
  const router = useRouter();
  const list = useActiveList();
  const insets = useSafeAreaInsets();
  const wheel = useRef<ClayWheelHandle>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const primary = useResolveClassNames("text-primary").color;
  const [game, dispatch] = useReducer(updateGame, undefined, () =>
    newGame(Math.floor(Math.random() * dinners.length)),
  );
  const current = game.current;
  const previousDinner = useRef(current);
  const dinner = dinners[current]!;
  const currentFits = fits(dinner, game.marks);
  const next = play(dinners, game, { type: "spin" });

  useEffect(() => {
    if (previousDinner.current === current) return;
    previousDinner.current = current;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    AccessibilityInfo.announceForAccessibility(dinners[current]!.name);
  }, [current]);

  // The spring finishes later. Apply its action to the latest choices.
  const advance = useCallback(() => dispatch({ type: "spin" }), []);

  function mark(axis: Axis) {
    dispatch({ type: "mark", axis });
    void Haptics.selectionAsync().catch(() => {});
  }

  function cook() {
    if (!list || !currentFits) return;
    const chatId = Crypto.randomUUID();
    queueMessage({
      chatId,
      listId: list.id,
      messageId: Crypto.randomUUID(),
      entry: "idea",
      // Deliberately no `idea`: that field opens another set of twists.
      text: cookDinnerMessage(dinner, game.marks),
      attachments: [],
    });
    router.push(`/chats/${chatId}` as never);
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: "What’s cooking?",
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          headerTintColor: primary,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: footerHeight + 24,
          gap: 12,
        }}
      >
        <ClayWheel
          ref={wheel}
          dinner={dinner}
          marks={game.marks}
          canSpin={!next.exhausted}
          onMark={mark}
          onSpin={advance}
        />
        {game.exhausted ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="px-6 text-center text-sm text-primary"
          >
            No other meal fits. Release one quality and try again.
          </Text>
        ) : !currentFits ? (
          <Text
            accessibilityLiveRegion="polite"
            className="px-6 text-center text-sm text-primary"
          >
            Spin to find a meal that fits your choices.
          </Text>
        ) : null}
        {game.trail.length ? (
          <View className="gap-2">
            <Text className="px-6 font-rounded text-xs font-semibold text-muted-foreground">
              Earlier
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
            >
              {game.trail.map((earlier) => {
                const previous = dinners[earlier.current]!;
                return (
                  <PressableScale
                    key={earlier.current}
                    accessibilityRole="button"
                    accessibilityLabel={`Revisit ${previous.name}`}
                    accessibilityHint="Restores the choices you had for that meal."
                    onPress={() =>
                      dispatch({
                        type: "revisit",
                        current: earlier.current,
                      })
                    }
                  >
                    <View className="w-36 items-center gap-1 rounded-[24px] bg-secondary px-2 pb-3 pt-1">
                      <DinnerFood dinner={previous} width={128} height={90} />
                      <Text className="text-center font-rounded text-xs font-bold">
                        {previous.name}
                      </Text>
                    </View>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      <View
        pointerEvents="box-none"
        className="absolute bottom-0 left-0 right-0 px-6 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 14) }}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      >
        <ScrollEdgeFade height={footerHeight} />
        <View className="flex-row gap-3">
          <Button
            onPress={() => wheel.current?.spin()}
            className="h-auto min-h-14 flex-1 gap-2 py-3"
          >
            <Text className="shrink text-center font-rounded text-base font-bold">
              Spin again
            </Text>
          </Button>
          <Button
            variant="outline"
            onPress={cook}
            disabled={!currentFits || !list}
            className="h-auto min-h-14 flex-1 py-3"
          >
            <Text className="shrink text-center font-rounded text-base font-bold">
              Cook this
            </Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
