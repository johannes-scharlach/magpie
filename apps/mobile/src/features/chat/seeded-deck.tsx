import { Image } from "expo-image";
import { useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";

import { clayTile, clayTilts, PressableScale } from "@/components/clay";
import { Text } from "@/components/ui/text";

import { SEEDED_ART } from "./seeded-art";
import ideas from "./seeded-ideas.json";

const GRID_GAP = 14;

type Seeded = (typeof ideas)[number] & {
  months?: number[];
  previewTitle?: string;
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
  const { width, fontScale } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState<number | null>(null);
  const columns = fontScale > 1.5 ? 1 : 2;
  const tileWidth = Math.floor(
    ((gridWidth ?? width - 32) - GRID_GAP * (columns - 1)) / columns,
  );
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
    <View className="gap-6 px-4 pb-4 pt-2">
      {groups.map((group, gi) => (
        <View key={`${gi}-${group.at(0)?.section}`} className="gap-2">
          <Text className="px-1 text-[13px] font-semibold text-muted-foreground">
            {group.at(0)?.section}
          </Text>
          <View
            className="flex-row flex-wrap"
            style={{ gap: GRID_GAP }}
            onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
          >
            {group.map((meal, index) => (
              <SeededCard
                key={meal.title}
                meal={meal}
                index={index}
                width={tileWidth}
                onPick={pick}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

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
      contentContainerClassName="gap-3.5 px-4 pb-3"
    >
      {deck.map((meal, index) => (
        <SeededCard
          key={meal.title}
          meal={meal}
          index={index}
          width={168}
          onPick={onPick}
        />
      ))}
    </ScrollView>
  );
}

/** The same clay card for Home's shelf and the full grid. */
function SeededCard({
  meal,
  index,
  width,
  onPick,
}: {
  meal: Seeded;
  index: number;
  width: number;
  onPick: (meal: Seeded) => void;
}) {
  return (
    <PressableScale
      onPress={() => onPick(meal)}
      tilt={clayTilts[index % clayTilts.length]}
      accessibilityRole="button"
      accessibilityLabel={`Explore ${meal.title}`}
      className="pt-10"
      style={{ width }}
    >
      <View
        className="min-h-[200px] justify-end bg-card px-3.5 pb-3.5 pt-[110px]"
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
        <Text className="font-rounded text-[17px] font-bold leading-[21px]">
          {meal.previewTitle ?? meal.title}
        </Text>
        <Text variant="muted" className="mt-1 font-rounded text-[13px]">
          {meal.time}
        </Text>
      </View>
    </PressableScale>
  );
}
