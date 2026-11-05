import {
  habitSlots,
  weekdayLabels,
  weekdayNames,
  weekdays,
  type MealIdeaSlot,
} from "@magpie/profile";
import { useEffect } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useResolveClassNames } from "uniwind";
import { Text } from "@/components/ui/text";
import { mealSlotsFromMask, mealSlotsMask } from "./meal-ideas";

/** The planning screen's two-row selection pattern, for a usual rather than dated week. */
export function UsualMealsPicker({
  value,
  onChange,
}: {
  value: MealIdeaSlot[];
  onChange: (slots: MealIdeaSlot[]) => void;
}) {
  const selected = mealSlotsMask(value);
  const mask = useSharedValue(selected);
  const width = useSharedValue(0);
  const rowHeight = useSharedValue(48);
  const start = useSharedValue(-1);
  const previewCell = useSharedValue(-1);
  const before = useSharedValue(0);
  const paint = useSharedValue(true);
  useEffect(() => {
    mask.set(selected);
  }, [mask, selected]);

  function commit(next: number) {
    onChange(mealSlotsFromMask(next));
  }

  function cellAt(x: number, y: number): number {
    "worklet";
    if (
      !width.get() ||
      x < 0 ||
      x >= width.get() ||
      y < 0 ||
      y >= rowHeight.get() * 2
    )
      return -1;
    return (
      Math.floor(y / rowHeight.get()) * 7 + Math.floor((x / width.get()) * 7)
    );
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-8, 8])
    .onBegin((event) => {
      start.set(cellAt(event.x, event.y));
      before.set(mask.get());
      paint.set(!(mask.get() & (1 << start.get())));
      previewCell.set(start.get());
    })
    .onUpdate((event) => {
      const first = start.get();
      const cell = cellAt(event.x, event.y);
      if (
        first < 0 ||
        cell < 0 ||
        Math.floor(first / 7) !== Math.floor(cell / 7)
      )
        return;
      let next = mask.get();
      // Fill crossed cells too, even when a fast swipe skips a touch event.
      for (
        let index = Math.min(first, cell);
        index <= Math.max(first, cell);
        index++
      )
        next = paint.get() ? next | (1 << index) : next & ~(1 << index);
      mask.set(next);
      previewCell.set(-1);
    })
    .onEnd((_event, success) => {
      if (success) {
        previewCell.set(-1);
        scheduleOnRN(commit, mask.get());
      } else {
        // Only an active, cancelled drag can roll back. A pan that never
        // activated may fail after the tap has already committed its choice.
        mask.set(before.get());
      }
    });
  const tap = Gesture.Tap()
    .onEnd((event, success) => {
      if (!success) return;
      const cell = cellAt(event.x, event.y);
      if (cell < 0) return;
      const next = mask.get() ^ (1 << cell);
      mask.set(next);
      previewCell.set(-1);
      scheduleOnRN(commit, next);
    })
    .onFinalize(() => {
      previewCell.set(-1);
    });

  return (
    <View className="gap-2">
      <Text className="text-sm text-muted-foreground">Tap or swipe</Text>
      <View className="flex-row gap-1.5">
        <View className="w-14" />
        <View className="flex-1 flex-row">
          {weekdays.map((day) => (
            <Text
              key={day}
              className="flex-1 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              {weekdayLabels[day][0]}
            </Text>
          ))}
        </View>
      </View>
      <View className="flex-row gap-1.5">
        <View className="w-14">
          {habitSlots.map((meal) => (
            <View
              key={meal}
              className="min-h-12 justify-center"
              style={{ height: 48 }}
            >
              <Text className="pr-1.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {meal}
              </Text>
            </View>
          ))}
        </View>
        <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
          <View
            className="flex-1"
            onLayout={(event) => width.set(event.nativeEvent.layout.width)}
          >
            {habitSlots.map((meal, row) => (
              <View
                key={meal}
                className="flex-row"
                onLayout={
                  row === 0
                    ? (event) => rowHeight.set(event.nativeEvent.layout.height)
                    : undefined
                }
              >
                {weekdays.map((day, column) => (
                  <MealCell
                    key={day}
                    mask={mask}
                    previewCell={previewCell}
                    index={row * 7 + column}
                    checked={!!(selected & (1 << (row * 7 + column)))}
                    label={`${weekdayNames[day]} ${meal}`}
                    onToggle={() => {
                      const next = mask.get() ^ (1 << (row * 7 + column));
                      mask.set(next);
                      commit(next);
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

function MealCell({
  mask,
  previewCell,
  index,
  checked,
  label,
  onToggle,
}: {
  mask: SharedValue<number>;
  previewCell: SharedValue<number>;
  index: number;
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  const onColor = useResolveClassNames("bg-accent").backgroundColor;
  const offColor = useResolveClassNames("bg-muted/45").backgroundColor;
  const style = useAnimatedStyle(() => ({
    backgroundColor:
      !!(mask.get() & (1 << index)) !== (previewCell.get() === index)
        ? onColor
        : offColor,
  }));
  const dot = useAnimatedStyle(() => ({
    opacity:
      !!(mask.get() & (1 << index)) !== (previewCell.get() === index) ? 1 : 0,
  }));
  return (
    <View
      accessible
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      accessibilityActions={[{ name: "activate", label: "Toggle meal" }]}
      onAccessibilityAction={onToggle}
      className="h-12 flex-1 justify-center px-[3px]"
    >
      <Animated.View
        style={style}
        className="h-9 items-center justify-center rounded-sm"
      >
        <Animated.View
          style={dot}
          className="size-1.5 rounded-full bg-primary"
        />
      </Animated.View>
    </View>
  );
}
