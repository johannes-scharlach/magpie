import { cuisineOptions, ingredientLabel } from "@magpie/profile";
import { SymbolView } from "expo-symbols";
import { Pressable, View } from "react-native";
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

/** One cuisine's cupboard: its distinctive ingredients, then the user's own words. */
export function CupboardFields({
  cuisine,
  keeps,
  onToggle,
  extras,
  onExtras,
  extra,
  onExtraChange,
  onAddExtra,
}: {
  cuisine: string;
  keeps: string[];
  onToggle: (id: string) => void;
  extras: string[];
  onExtras: (extras: string[]) => void;
  extra: string;
  onExtraChange: (value: string) => void;
  onAddExtra: () => void;
}) {
  const { tileWidth, onLayout } = useTileLayout(true);
  const iconColor = useResolveClassNames("text-foreground").color;
  const listed = cuisineOptions[cuisine]?.ingredients ?? [];

  return (
    <View className="gap-5">
      {listed.length ? (
        <View className="flex-row flex-wrap" style={{ gap: TILE_GAP }} onLayout={onLayout}>
          {listed.map((id, index) => (
            <ArtTile
              key={id}
              art={`ingredient-${id}` as ArtworkId}
              title={ingredientLabel(id)}
              width={tileWidth}
              tilt={clayTilts[index % clayTilts.length]}
              selected={keeps.includes(id)}
              onPress={() => onToggle(id)}
            />
          ))}
        </View>
      ) : null}
      {extras.length ? (
        <View className="flex-row flex-wrap items-start gap-2">
          {extras.map((label) => (
            <ChoiceChip
              key={label}
              label={label}
              selected
              onPress={() => onExtras(extras.filter((e) => e !== label))}
            />
          ))}
        </View>
      ) : null}
      <View className="gap-2">
        <Text className="text-sm font-medium">Anything else you keep for it?</Text>
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
      </View>
    </View>
  );
}
