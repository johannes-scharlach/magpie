import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { clayTile, PressableScale } from "@/components/clay";
import { Text } from "@/components/ui/text";

import { ingredientsLine } from "./ingredients-line";
import { SEEDED_ART } from "./seeded-art";
import ideas from "./seeded-ideas.json";

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const CLOCK_ICON = { ios: "clock", android: "schedule" } as const;
const THUMB = 56;

type Seeded = (typeof ideas)[number] & {
  months?: number[];
  previewTitle?: string;
  previewIngredients?: string;
};

/** In-season first, out-of-season last, everything else in file order. */
function bySeason(month: number): Seeded[] {
  const rank = (m: Seeded) =>
    !m.months ? 1 : m.months.includes(month) ? 0 : 2;
  return [...(ideas as Seeded[])].sort((a, b) => rank(a) - rank(b));
}

/**
 * The from-nothing path: thirty-odd weeknight meals you can start from
 * without pulling anything out of the fridge. Home previews a few as a
 * shelf of clay tiles, with the full deck on its own screen. Bundled JSON, not
 * cookbook rows: they are inspiration, and the cookbook only
 * holds what was actually saved. Seasonal ones sit first while their
 * months are on, and last otherwise.
 */
export function SeededDeck({
  onPick,
  preview = false,
}: {
  onPick: (text: string, idea: string) => void;
  preview?: boolean;
}) {
  const deck = bySeason(new Date().getMonth() + 1);
  // An idea is a starting point: the reply offers directions, not a Sketch.
  function pick(meal: Seeded) {
    onPick(`Give me a few directions for: ${meal.title}`, meal.title);
  }

  if (preview) return <SeededShelf deck={deck.slice(0, 6)} onPick={pick} />;

  // The seasonal sort scatters only when a section is out of season, so
  // same-section ideas stay adjacent: one pass into consecutive groups.
  const groups: Seeded[][] = [];
  for (const meal of deck) {
    const group = groups.at(-1);
    if (group && group.at(0)?.section === meal.section) group.push(meal);
    else groups.push([meal]);
  }

  return (
    <View className="gap-5 pb-4 pt-2">
      {groups.map((group, gi) => (
        <View key={`${gi}-${group.at(0)?.section}`} className="gap-2">
          {/* Shop's section headers: sentence case, quiet, aligned to the card. */}
          <Text className="px-4 text-[13px] font-semibold text-muted-foreground">
            {group.at(0)?.section}
          </Text>
          <View className="mx-4 overflow-hidden rounded-2xl bg-card">
            {group.map((meal, mi) => (
              <View key={meal.title}>
                {mi > 0 ? (
                  <View
                    className="border-t border-border"
                    style={{ marginLeft: 16 + THUMB + 12 }}
                  />
                ) : null}
                <SeededRow meal={meal} onPick={pick} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const TILTS = [-2, 1.5, -1, 2, -1.5, 1];

/** Clay figures standing on tiles, slightly askew, art popping out the top. */
function SeededShelf({
  deck,
  onPick,
}: {
  deck: Seeded[];
  onPick: (meal: Seeded) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="-mx-4"
      contentContainerClassName="gap-3.5 px-4 pb-3 pt-9"
    >
      {deck.map((meal, i) => (
        <PressableScale
          key={meal.title}
          onPress={() => onPick(meal)}
          tilt={TILTS[i % TILTS.length]}
          accessibilityRole="button"
          accessibilityLabel={`Explore ${meal.title}`}
        >
          <View
            className="h-[200px] w-[168px] justify-end bg-card px-3.5 pb-3.5"
            style={clayTile}
          >
            <Image
              source={SEEDED_ART[meal.title]}
              contentFit="contain"
              accessibilityIgnoresInvertColors
              style={{
                position: "absolute",
                top: -40,
                left: 4,
                right: 4,
                height: 150,
              }}
            />
            <Text
              numberOfLines={2}
              className="font-rounded text-[17px] font-bold leading-[21px]"
            >
              {meal.previewTitle ?? meal.title}
            </Text>
            <Text variant="muted" className="mt-1 font-rounded text-[13px]">
              {meal.time}
            </Text>
          </View>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

/** Press feedback is a smoothed bg-card -> bg-accent crossfade, not an instant swap. */
function usePressFade() {
  const pressed = useSharedValue(0);
  const cardBg = useResolveClassNames("bg-card").backgroundColor as string;
  const accentBg = useResolveClassNames("bg-accent").backgroundColor as string;
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      pressed.get(),
      [0, 1],
      [cardBg, accentBg],
    ),
  }));
  return {
    style,
    onPressIn: () =>
      pressed.set(withTiming(1, { duration: 120, easing: EASE_OUT })),
    onPressOut: () =>
      pressed.set(withTiming(0, { duration: 120, easing: EASE_OUT })),
  };
}

function SeededRow({
  meal,
  onPick,
}: {
  meal: Seeded;
  onPick: (meal: Seeded) => void;
}) {
  const { style, onPressIn, onPressOut } = usePressFade();
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const art = SEEDED_ART[meal.title];

  return (
    <Pressable
      onPress={() => onPick(meal)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Explore ${meal.title}`}
    >
      <Animated.View
        className="flex-row items-center gap-3 px-4 py-3"
        style={style}
      >
        {art ? (
          <Image
            source={art}
            contentFit="contain"
            accessibilityIgnoresInvertColors
            style={{ width: THUMB, height: THUMB }}
          />
        ) : null}
        <View className="flex-1 gap-0.5">
          <Text
            className="text-[17px] font-semibold leading-snug"
            numberOfLines={1}
          >
            {meal.previewTitle ?? meal.title}
          </Text>
          <IngredientsLine
            ingredients={meal.previewIngredients ?? meal.ingredients}
          />
          <View className="flex-row items-center gap-1">
            <SymbolView name={CLOCK_ICON} tintColor={mutedColor} size={11} />
            <Text variant="muted" className="text-xs">
              {meal.time}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function IngredientsLine({ ingredients }: { ingredients: string }) {
  const [line, setLine] = useState(ingredients);
  return (
    <View>
      <Text variant="muted" className="text-sm" numberOfLines={1}>
        {line}
      </Text>
      {/* Invisible and unclamped: its first line is what fits. */}
      <Text
        variant="muted"
        className="absolute inset-x-0 top-0 text-sm opacity-0"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onTextLayout={(e) =>
          setLine(
            ingredientsLine(
              ingredients,
              e.nativeEvent.lines[0]?.text ?? ingredients,
            ),
          )
        }
      >
        {ingredients}
      </Text>
    </View>
  );
}
