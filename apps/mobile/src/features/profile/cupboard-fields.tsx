import { ingredientLabel } from "@magpie/profile";
import { SymbolView } from "expo-symbols";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  Keyframe,
  ReduceMotion,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";
import { clayTilts } from "@/components/clay";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { type ArtworkId } from "@/features/onboarding/artwork";
import {
  ArtTile,
  ChoiceChip,
  TILE_GAP,
  useTileLayout,
} from "@/features/profile/choice-tiles";

const ADD_ICON = { ios: "plus.circle", android: "add_circle" } as const;

// Like rows inserted into an iOS list: each line comes out from under the
// one above it, just after it. Reduce Motion keeps the fades.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
// A Keyframe's setters mutate it, so each line gets its own.
function lineIn(line: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: -12 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
  })
    .duration(250)
    .delay(80 + line * 80)
    .reduceMotion(ReduceMotion.Never);
}

/** One cuisine's cupboard: its distinctive ingredients, then the user's own words. */
export function CupboardFields({
  ingredients,
  keeps,
  onToggle,
  extras,
  onRemoveExtra,
  extra,
  onExtraChange,
  onAddExtra,
}: {
  ingredients: readonly string[];
  keeps: string[];
  onToggle: (id: string) => void;
  extras: string[];
  onRemoveExtra: (extra: string) => void;
  extra: string;
  onExtraChange: (value: string) => void;
  onAddExtra: () => void;
}) {
  const { columns, tileWidth, onLayout } = useTileLayout(true);
  const iconColor = useResolveClassNames("text-foreground").color;
  const rows = Array.from(
    { length: Math.ceil(ingredients.length / columns) },
    (_, row) => ingredients.slice(row * columns, (row + 1) * columns),
  );
  return (
    <View className="gap-5">
      {rows.length ? (
        <View style={{ gap: TILE_GAP }} onLayout={onLayout}>
          {rows.map((row, line) => (
            <Animated.View
              key={row.join()}
              entering={lineIn(line)}
              className="flex-row"
              style={{ gap: TILE_GAP }}
            >
              {row.map((id) => {
                const index = ingredients.indexOf(id);
                return (
                  <ArtTile
                    key={id}
                    art={`ingredient-${id}` as ArtworkId}
                    title={ingredientLabel(id)}
                    width={tileWidth}
                    tilt={clayTilts[index % clayTilts.length]}
                    selected={keeps.includes(id)}
                    onPress={() => onToggle(id)}
                  />
                );
              })}
            </Animated.View>
          ))}
        </View>
      ) : null}
      {extras.length ? (
        <Animated.View
          entering={lineIn(rows.length)}
          className="flex-row flex-wrap items-start gap-2"
        >
          {extras.map((label) => (
            <ChoiceChip
              key={label}
              label={label}
              selected
              onPress={() => onRemoveExtra(label)}
            />
          ))}
        </Animated.View>
      ) : null}
      <Animated.View
        entering={lineIn(rows.length + (extras.length ? 1 : 0))}
        className="gap-2"
      >
        <Text className="text-sm font-medium">
          Anything else you keep for it?
        </Text>
        <View className="min-h-12 flex-row items-center rounded-2xl bg-muted pr-1">
          <Input
            accessibilityLabel="Anything else you keep for it?"
            placeholder="Add an ingredient"
            className="h-12 min-h-0 flex-1 border-0 bg-transparent px-3.5 py-1"
            value={extra}
            onChangeText={onExtraChange}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={onAddExtra}
            // Continue or Back dismisses the keyboard; what's typed still counts.
            onBlur={onAddExtra}
          />
          {extra.trim() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add ingredient"
              onPress={onAddExtra}
              className="h-12 w-10 items-center justify-center self-end active:opacity-60"
            >
              <SymbolView name={ADD_ICON} tintColor={iconColor} size={22} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}
