import { cuisineOptions, ingredientLabel } from "@magpie/profile";
import { useState } from "react";
import { View } from "react-native";
import { type ArtworkId } from "@/features/onboarding/artwork";
import {
  ArtTile,
  ChoiceChip,
  TILE_GAP,
  useTileWidth,
} from "@/features/profile/choice-tiles";
import { Field } from "@/features/profile/form";

/** One cuisine's cupboard: its distinctive ingredients, then the user's own words. */
export function CupboardFields({
  cuisine,
  keeps,
  onToggle,
  extras,
  onExtras,
}: {
  cuisine: string;
  keeps: string[];
  onToggle: (id: string) => void;
  extras: string[];
  onExtras: (extras: string[]) => void;
}) {
  const tileWidth = useTileWidth(true);
  const [extra, setExtra] = useState("");
  const listed = cuisineOptions[cuisine]?.ingredients ?? [];

  function addExtra() {
    const typed = extra.trim();
    if (!typed) return;
    if (!extras.some((e) => e.toLowerCase() === typed.toLowerCase())) {
      onExtras([...extras, typed]);
    }
    setExtra("");
  }

  return (
    <View className="gap-5">
      {listed.length ? (
        <View className="flex-row flex-wrap" style={{ gap: TILE_GAP }}>
          {listed.map((id) => (
            <ArtTile
              key={id}
              art={`ingredient-${id}` as ArtworkId}
              title={ingredientLabel(id)}
              width={tileWidth}
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
      <Field
        label="Anything else you keep for it?"
        placeholder="Add an ingredient"
        value={extra}
        onChangeText={setExtra}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={addExtra}
        onBlur={addExtra}
      />
    </View>
  );
}
