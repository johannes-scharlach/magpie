import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import { useEffect, useReducer, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { clayTile } from "@/components/clay";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cookDinnerMessage } from "@/features/chat/compose";
import { queueMessage } from "@/features/chat/message-queue";
import { useActiveList } from "@/features/onboarding/access";
import { ScrollEdgeFade } from "@/features/onboarding/scroll-edge-fade";

import { DinnerFood } from "./dinner-food";
import { dinners } from "./dinners";
import {
  axes,
  keptMarks,
  newGame,
  play,
  reel,
  type Action,
  type Game,
} from "./game";
import { Reel } from "./reel";

const ARRIVE = FadeIn.duration(180).reduceMotion(ReduceMotion.System);
const ART_HEIGHT = 190;

function updateGame(game: Game, action: Action) {
  return play(dinners, game, action);
}

function randomDinner(except?: number) {
  const index = Math.floor(Math.random() * (dinners.length - 1));
  return except === undefined || index < except ? index : index + 1;
}

export function DinnerReels() {
  const router = useRouter();
  const list = useActiveList();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [footerHeight, setFooterHeight] = useState(0);
  const primary = useResolveClassNames("text-primary").color;
  const [game, dispatch] = useReducer(updateGame, undefined, () =>
    newGame(dinners, randomDinner()),
  );
  const current = game.current;
  const dinner = dinners[current]!;
  const previousDinner = useRef(current);

  useEffect(() => {
    if (previousDinner.current === current) return;
    previousDinner.current = current;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    AccessibilityInfo.announceForAccessibility(dinners[current]!.name);
  }, [current]);

  function startCookingChat() {
    if (!list) return;
    const chatId = Crypto.randomUUID();
    queueMessage({
      chatId,
      listId: list.id,
      messageId: Crypto.randomUUID(),
      entry: "idea",
      // Deliberately no `idea`: that field opens another set of twists.
      text: cookDinnerMessage(dinner, keptMarks(game.choices)),
      attachments: [],
    });
    router.push(`/chats/${chatId}` as never);
  }

  const kept = axes.filter(({ id }) => game.choices[id] !== undefined);

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
        contentContainerClassName="gap-5 px-4"
        contentContainerStyle={{ paddingBottom: footerHeight + 24 }}
      >
        <View className="pt-12">
          <View
            className="bg-card px-5 pb-5"
            style={[clayTile, { paddingTop: ART_HEIGHT - 32 }]}
          >
            <Animated.View
              key={dinner.family}
              entering={ARRIVE}
              pointerEvents="none"
              className="absolute left-0 right-0 items-center"
              style={{ top: -48 }}
            >
              <DinnerFood
                dinner={dinner}
                width={width - 48}
                height={ART_HEIGHT}
              />
            </Animated.View>
            <Animated.View
              key={dinner.title}
              entering={ARRIVE}
              className="gap-1.5"
            >
              <Text className="font-rounded text-2xl font-extrabold leading-8 text-primary">
                {dinner.name}
              </Text>
              <Text
                variant="muted"
                className="font-rounded text-sm"
                style={{ fontVariant: "tabular-nums" }}
              >
                {dinner.activeMinutes} min hands-on · {dinner.totalMinutes} min
                total
              </Text>
              <Text className="text-base leading-6">{dinner.pitch}</Text>
            </Animated.View>
          </View>
        </View>

        {kept.length ? (
          <View className="flex-row flex-wrap gap-2">
            {kept.map(({ id, name }) => (
              <Animated.View
                key={id}
                entering={ARRIVE}
                accessible
                accessibilityLabel={`${name}: ${game.choices[id]}, kept`}
                className="rounded-2xl bg-accent px-3 py-1.5"
                style={{ borderCurve: "continuous" }}
              >
                <Text className="text-[11px] font-semibold text-muted-foreground">
                  {name}
                </Text>
                <Text className="font-rounded text-sm font-bold text-primary">
                  {game.choices[id]}
                </Text>
              </Animated.View>
            ))}
          </View>
        ) : null}

        {game.reels.length ? (
          <View className="flex-row gap-2">
            {game.reels.map((axis) => {
              const label = axes.find(({ id }) => id === axis)!.name;
              return (
                <View key={axis} className="min-w-0 flex-1 gap-1">
                  <Text className="text-center text-xs font-semibold text-muted-foreground">
                    {label}
                  </Text>
                  <Reel
                    label={label}
                    values={reel(dinners, game, axis)}
                    value={dinner.qualities[axis]}
                    onChange={(value) => dispatch({ type: "set", axis, value })}
                  />
                </View>
              );
            })}
          </View>
        ) : (
          <Text
            accessibilityLiveRegion="polite"
            className="text-center text-sm text-muted-foreground"
          >
            Nothing left to change.
          </Text>
        )}
      </ScrollView>

      <View
        pointerEvents="box-none"
        className="absolute bottom-0 left-0 right-0 px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 14) }}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      >
        <ScrollEdgeFade height={footerHeight} />
        <View className="flex-row gap-3">
          <Button
            variant="outline"
            onPress={() => dispatch({ type: "back" })}
            disabled={!game.previous}
            accessibilityHint="Undoes your last change."
            className="h-auto min-h-14 px-5 py-3"
          >
            <Text className="font-rounded text-base font-bold">Back</Text>
          </Button>
          <Button
            variant="outline"
            onPress={() =>
              dispatch({ type: "spin", current: randomDinner(game.current) })
            }
            accessibilityHint="Starts over with a new dinner."
            className="h-auto min-h-14 flex-1 py-3"
          >
            <Text className="font-rounded text-base font-bold">Spin</Text>
          </Button>
          <Button
            onPress={startCookingChat}
            accessibilityHint="Starts a chat about making this meal."
            disabled={!list}
            className="h-auto min-h-14 flex-1 py-3"
          >
            <Text className="font-rounded text-base font-bold">Cook this</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
