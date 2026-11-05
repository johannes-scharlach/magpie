import { mealIdeasForSlots, type MealIdeaSlot } from "@magpie/profile";
import { useState } from "react";
import { View } from "react-native";
import { RowReveal } from "@/components/row-reveal";
import { Text } from "@/components/ui/text";
import {
  changeMealIdeasOpening,
  changeMealIdeasDetail,
  mealIdeasDetail,
  readMealIdeasSelection,
} from "@/features/profile/meal-ideas";
import { UsualMealsPicker } from "@/features/profile/usual-meals-picker";
import { MealIdeasGuidanceEditor } from "@/features/profile/meal-ideas-guidance-editor";

const examples = [
  "We want rice and stuff at least twice a week.",
  "We cook enough dinner for lunch the next day.",
];

/** Choices start the writing; examples show what the user can add. */
export function MealIdeasEditor({
  value,
  onChange,
  onInputHeightChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onInputHeightChange?: (height: number) => void;
}) {
  const { opening, slots } = readMealIdeasSelection(value);
  const guidance = mealIdeasDetail(value);
  // An emptied input stays editable until Clear is pressed.
  const [writing, setWriting] = useState(false);

  function selectMeals(chosen: MealIdeaSlot[]) {
    const next = mealIdeasForSlots(chosen);
    onChange(changeMealIdeasOpening(value, opening, next));
  }

  return (
    <View className="gap-6">
      <UsualMealsPicker value={slots} onChange={selectMeals} />
      <View className="gap-4">
        <Text className="font-medium">
          What would make those ideas work for you?
        </Text>
        <MealIdeasGuidanceEditor
          value={guidance || (writing ? "" : null)}
          onChange={(next) => {
            setWriting(next !== null);
            onChange(changeMealIdeasDetail(value, next ?? ""));
          }}
          onInputHeightChange={onInputHeightChange}
        >
          <GuidanceExamples />
        </MealIdeasGuidanceEditor>
      </View>
    </View>
  );
}

function GuidanceExamples() {
  const rows = ["You could add…", ...examples.map((example) => `“${example}”`)];
  return (
    <View className="gap-1">
      {rows.map((row, index) => {
        const text = (
          <Text key={row} className="text-sm leading-6 text-muted-foreground">
            {row}
          </Text>
        );
        return (
          <RowReveal key={row} index={index + 1}>
            {text}
          </RowReveal>
        );
      })}
    </View>
  );
}
