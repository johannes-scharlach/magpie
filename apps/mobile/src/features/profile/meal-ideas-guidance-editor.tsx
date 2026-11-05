import { newDishesAnswers, type NewDishes } from "@magpie/profile";
import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";
import { clayTile, PressableScale } from "@/components/clay";
import { RowReveal } from "@/components/row-reveal";
import { Text } from "@/components/ui/text";
import { Field } from "@/features/profile/form";

const newDishesPresentation: Record<
  NewDishes,
  { title: string; detail: string }
> = {
  rarely: {
    title: "Familiar favourites",
    detail: "Mostly recipes you already make.",
  },
  sometimes: {
    title: "One new dish a week",
    detail: "Mostly favourites, with about one new dish a week.",
  },
  often: {
    title: "New discoveries",
    detail: "Mostly recipes you haven’t tried yet.",
  },
};

/** A choice gives a complete answer; Clear returns to the three starting points. */
export function MealIdeasGuidanceEditor({
  value,
  onChange,
  onInputHeightChange,
  children,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  onInputHeightChange?: (height: number) => void;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  // Keep the surface mounted: the choices live inside the eventual input.
  // Native layout measures both modes, including large text and custom answers.
  const resize = LinearTransition.duration(250)
    .easing(Easing.bezier(0.77, 0, 0.175, 1))
    .reduceMotion(ReduceMotion.System);
  const entering = FadeIn.duration(reduced ? 100 : 150)
    .delay(reduced ? 0 : 100)
    .easing(Easing.bezier(0.23, 1, 0.32, 1))
    .reduceMotion(ReduceMotion.Never);
  const exiting = FadeOut.duration(100)
    .easing(Easing.bezier(0.23, 1, 0.32, 1))
    .reduceMotion(ReduceMotion.Never);
  return (
    <View collapsable={false}>
      <Animated.View
        layout={resize}
        className="overflow-hidden bg-card"
        style={clayTile}
        collapsable={false}
      >
        <Animated.View
          key={value === null ? "choices" : "answer"}
          entering={entering}
          exiting={exiting}
        >
          {value === null ? (
            <View className="gap-3 p-3">
              {(Object.keys(newDishesPresentation) as NewDishes[]).map(
                (key) => (
                  <NewDishCard
                    key={key}
                    choice={key}
                    onPress={() => onChange(newDishesAnswers[key])}
                  />
                ),
              )}
            </View>
          ) : (
            <Field
              label="What would make those ideas work for you?"
              hideLabel
              testID="meal-ideas-guidance"
              value={value}
              onChangeText={onChange}
              multiline
              scrollEnabled={false}
              className="min-h-24 rounded-none border-0 bg-transparent px-5 py-4 text-base leading-7"
              onLayout={(event) =>
                onInputHeightChange?.(event.nativeEvent.layout.height)
              }
            />
          )}
        </Animated.View>
      </Animated.View>
      {value !== null ? (
        <Animated.View
          key="answer-details"
          layout={resize}
          exiting={exiting}
          className="gap-0"
        >
          <RowReveal index={0}>
            <Pressable
              accessibilityRole="button"
              className="min-h-11 self-end justify-center px-3"
              onPress={() => {
                onChange(null);
                onInputHeightChange?.(0);
              }}
            >
              <Text className="font-medium text-primary">Clear</Text>
            </Pressable>
          </RowReveal>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

function NewDishCard({
  choice,
  onPress,
}: {
  choice: NewDishes;
  onPress: () => void;
}) {
  const { title, detail } = newDishesPresentation[choice];
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
    >
      <View
        className="min-h-12 gap-1 bg-secondary px-5 py-4"
        style={{ ...clayTile, borderRadius: 16 }}
      >
        <Text className="font-rounded text-[17px] font-bold leading-5.5">
          {title}
        </Text>
        <Text className="text-sm leading-5 text-muted-foreground">
          {detail}
        </Text>
      </View>
    </PressableScale>
  );
}
