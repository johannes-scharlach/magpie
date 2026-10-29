/** The rim follows the finger; quality tags stay put and within reach. */
import { SymbolView } from "expo-symbols";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import { useColorScheme, useWindowDimensions, View } from "react-native";
import {
  GestureDetector,
  GestureStateManager,
  State,
  usePanGesture,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDecay,
  withSpring,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { useResolveClassNames } from "uniwind";

import { PressableScale } from "@/components/clay";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { DinnerFood } from "./dinner-food";
import { axes, type Axis, type Dinner, type Marks } from "./game";
import { angularVelocity, isTangential, rotationDelta } from "./wheel-motion";

const ARRIVE = FadeIn.duration(140).reduceMotion(ReduceMotion.System);
const TILTS = [-1.2, 0.8, -0.6, 1.1, 0.7, -1, 1.2, -0.7] as const;
const WEDGES = [
  "#E8C8B8",
  "#EED9AE",
  "#D9DFBC",
  "#BFD4C5",
  "#C5D7D9",
  "#D2CBDF",
  "#E3C5D2",
  "#E8C7B4",
] as const;
const DARK_WEDGES = [
  "#62483E",
  "#5E5138",
  "#4B5138",
  "#3B5549",
  "#3D5257",
  "#4B435A",
  "#593E4D",
  "#60463C",
] as const;
const PLATES: Record<string, string> = {
  Pasta: "#F3DFC0",
  Rice: "#F1E4C5",
  Potato: "#EAD5BB",
  Bread: "#F0CDBD",
  Veg: "#DCE4CB",
  Beans: "#EBC7B4",
  Noodles: "#DDE8C8",
  Fruit: "#EFC9C0",
};
const DARK_PLATES: Record<string, string> = {
  Pasta: "#594B38",
  Rice: "#574F3D",
  Potato: "#55483B",
  Bread: "#593F38",
  Veg: "#3E4B3B",
  Beans: "#583F36",
  Noodles: "#404B38",
  Fruit: "#573C3D",
};

function useWheelColors() {
  return {
    ink: useResolveClassNames("text-turntable-ink").color,
    body: useResolveClassNames("text-foreground").color,
    muted: useResolveClassNames("text-muted-foreground").color,
    card: useResolveClassNames("bg-card").backgroundColor,
    border: useResolveClassNames("border-border").borderColor,
    underside: useResolveClassNames("bg-turntable-underside").backgroundColor,
    disc: useResolveClassNames("bg-turntable-disc").backgroundColor,
    kept: useResolveClassNames("bg-accent").backgroundColor,
    avoided: useResolveClassNames("bg-secondary dark:bg-card").backgroundColor,
    shine: useResolveClassNames("text-card dark:text-foreground").color,
  };
}

function point(radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return `${200 + radius * Math.cos(radians)} ${200 + radius * Math.sin(radians)}`;
}

function wedge(index: number) {
  const start = -90 + index * 45 + 2;
  const end = start + 41;
  return `M ${point(151, start)} L ${point(184, start)} A 184 184 0 0 1 ${point(184, end)} L ${point(151, end)} A 151 151 0 0 0 ${point(151, start)} Z`;
}

function QualityToken({
  axis,
  dinner,
  marks,
  onMark,
  index,
  width,
  colors,
}: {
  axis: (typeof axes)[number];
  dinner: Dinner;
  marks: Marks;
  onMark: (axis: Axis) => void;
  index: number;
  width: number;
  colors: ReturnType<typeof useWheelColors>;
}) {
  const mark = marks[axis.id];
  const value = mark?.value ?? dinner.qualities[axis.id];
  const kept = mark?.mode === "keep";
  const avoided = mark?.mode === "avoid";
  const state = kept ? "kept" : avoided ? "ruled out" : "open";
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${axis.name}: ${value}, ${state}`}
      accessibilityHint={
        kept
          ? "Tap to rule it out instead."
          : avoided
            ? "Tap to release this choice."
            : "Tap to keep this quality when you spin."
      }
      accessibilityState={{ selected: kept }}
      onPress={() => onMark(axis.id)}
      tilt={TILTS[index]!}
      style={{ width }}
    >
      <View className="min-h-[72px] justify-center px-1 py-1.5">
        <View
          pointerEvents="none"
          className="absolute inset-0 rounded-[19px]"
          style={{
            backgroundColor: colors.underside,
            opacity: avoided ? 0.35 : 0.8,
            transform: [{ translateY: 3 }],
          }}
        />
        <View
          className={cn(
            "min-h-[60px] items-center justify-center gap-0.5 rounded-[18px] border px-1 py-1.5",
            avoided && "border-dashed",
          )}
          style={{
            backgroundColor: kept
              ? colors.kept
              : avoided
                ? colors.avoided
                : colors.card,
            borderColor: kept ? colors.kept : colors.border,
            borderCurve: "continuous",
          }}
        >
          <Text
            numberOfLines={1}
            className="text-center text-[10px] font-semibold uppercase tracking-[0.2px]"
            style={{ color: colors.muted }}
          >
            {axis.name}
          </Text>
          <Animated.View key={value} entering={ARRIVE}>
            <Text
              className={cn(
                "text-center font-rounded text-sm font-extrabold leading-5",
                avoided && "line-through",
              )}
              style={{
                color: avoided ? colors.muted : kept ? colors.ink : colors.body,
              }}
            >
              {value}
            </Text>
          </Animated.View>
        </View>
        {kept || avoided ? (
          <Animated.View
            entering={ARRIVE}
            pointerEvents="none"
            className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full border-2"
            style={{
              backgroundColor: kept ? colors.ink : colors.card,
              borderColor: kept ? colors.card : colors.border,
            }}
          >
            <SymbolView
              name={
                kept
                  ? { ios: "checkmark", android: "check" }
                  : { ios: "xmark", android: "close" }
              }
              tintColor={kept ? colors.card : colors.muted}
              size={10}
            />
          </Animated.View>
        ) : null}
      </View>
    </PressableScale>
  );
}

export type ClayWheelHandle = { spin: () => void };
type ClayWheelProps = {
  dinner: Dinner;
  marks: Marks;
  canSpin: boolean;
  onMark: (axis: Axis) => void;
  onSpin: () => void;
};

export const ClayWheel = forwardRef<ClayWheelHandle, ClayWheelProps>(
  function ClayWheel({ dinner, marks, canSpin, onMark, onSpin }, ref) {
    const reduced = useReducedMotion();
    const { width: windowWidth, fontScale } = useWindowDimensions();
    const colors = useWheelColors();
    const dark = useColorScheme() === "dark";
    const size = Math.min(windowWidth + 64, 520);
    const tokenWidth = size * 0.21;
    const tokenHeight = 72;
    // Keep the controls on-screen while the rim extends beyond the viewport.
    const radius = size * 0.335;
    const expanded = windowWidth < 390 || fontScale > 1.25;
    const rotation = useSharedValue(0);
    const startPoint = useSharedValue({ x: 0, y: 0 });
    const lastPoint = useSharedValue({ x: 0, y: 0 });
    const travel = useSharedValue(0);
    const dragState = useSharedValue<"idle" | "held" | "turning">("idle");
    const leaving = useSharedValue(false);
    const foodScale = useSharedValue(1);
    const previousDinner = useRef(dinner.title);

    const settle = useCallback(() => {
      leaving.set(false);
      onSpin();
    }, [leaving, onSpin]);

    const snap = useCallback(
      (commit: boolean) => {
        "worklet";
        // A gentle detent keeps the colors centered beneath the fixed labels.
        const target = Math.round(rotation.get() / 45) * 45;
        rotation.set(
          withSpring(
            target,
            {
              duration: 400,
              dampingRatio: 0.8,
              reduceMotion: ReduceMotion.System,
            },
            (finished) => {
              if (finished && commit) scheduleOnRN(settle);
            },
          ),
        );
      },
      [rotation, settle],
    );

    const coast = useCallback(
      (velocity: number) => {
        "worklet";
        leaving.set(true);
        rotation.set(
          withDecay(
            { velocity, reduceMotion: ReduceMotion.System },
            (finished) => {
              if (finished) snap(true);
            },
          ),
        );
      },
      [leaving, rotation, snap],
    );

    const spin = useCallback(() => {
      if (leaving.get()) return;
      if (!canSpin || reduced) {
        onSpin();
        return;
      }
      coast(720);
    }, [canSpin, coast, leaving, onSpin, reduced]);

    useImperativeHandle(ref, () => ({ spin }), [spin]);

    useLayoutEffect(() => {
      if (previousDinner.current === dinner.title) return;
      previousDinner.current = dinner.title;
      cancelAnimation(rotation);
      leaving.set(false);
      if (reduced) {
        foodScale.set(1);
        return;
      }
      foodScale.set(0.94);
      foodScale.set(
        withSpring(1, {
          duration: 400,
          dampingRatio: 0.8,
          reduceMotion: ReduceMotion.System,
        }),
      );
    }, [dinner.title, foodScale, leaving, reduced, rotation]);

    const gesture = usePanGesture({
      manualActivation: true,
      maxPointers: 1,
      onBegin: (event) => {
        dragState.set("idle");
        const point = { x: event.x - size / 2, y: event.y - size / 2 };
        const distance = Math.hypot(point.x, point.y);
        if (distance < size * 0.2 || distance > size * 0.49) {
          GestureStateManager.fail(event.handlerTag);
          return;
        }
        // Catch a moving wheel on touch-down, not after the drag threshold.
        cancelAnimation(rotation);
        leaving.set(false);
        dragState.set("held");
        startPoint.set(point);
        lastPoint.set(point);
        travel.set(0);
      },
      onTouchesMove: (event) => {
        if (event.state !== State.BEGAN || dragState.get() !== "held") return;
        const touch = event.allTouches[0];
        if (!touch) return;
        const start = startPoint.get();
        const movement = {
          x: touch.x - size / 2 - start.x,
          y: touch.y - size / 2 - start.y,
        };
        if (Math.hypot(movement.x, movement.y) < 6) return;
        if (isTangential(start, movement)) {
          GestureStateManager.activate(event.handlerTag);
        } else {
          // A radial drag belongs to the page's ScrollView.
          GestureStateManager.fail(event.handlerTag);
        }
      },
      onActivate: () => {
        dragState.set("turning");
      },
      onUpdate: (event) => {
        const point = { x: event.x - size / 2, y: event.y - size / 2 };
        const previous = lastPoint.get();
        lastPoint.set(point);
        if (Math.hypot(point.x, point.y) < size * 0.2) return;
        const delta = rotationDelta(previous, point);
        travel.set(travel.get() + delta);
        if (!reduced) rotation.set(rotation.get() + delta);
      },
      onDeactivate: (event) => {
        const point = { x: event.x - size / 2, y: event.y - size / 2 };
        const velocity =
          Math.hypot(point.x, point.y) < size * 0.2
            ? 0
            : angularVelocity(point, {
                x: event.velocityX,
                y: event.velocityY,
              });
        const commit =
          !event.canceled &&
          (Math.abs(travel.get()) >= 12 || Math.abs(velocity) >= 90);
        if (!commit || !canSpin || reduced) {
          snap(false);
          if (commit) scheduleOnRN(onSpin);
          return;
        }
        coast(velocity);
      },
      onFinalize: () => {
        if (dragState.get() === "held") snap(false);
        dragState.set("idle");
      },
    });

    const rimStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${rotation.get()}deg` }],
    }));
    const foodStyle = useAnimatedStyle(() => ({
      transform: [{ scale: foodScale.get() }],
    }));
    const plate =
      (dark ? DARK_PLATES : PLATES)[dinner.qualities.base] ?? colors.kept;

    function token(axis: (typeof axes)[number], index: number, width: number) {
      return (
        <QualityToken
          axis={axis}
          dinner={dinner}
          marks={marks}
          onMark={onMark}
          index={index}
          width={width}
          colors={colors}
        />
      );
    }

    return (
      <View className="gap-2">
        <View className="items-center overflow-hidden">
          <View style={{ width: size, height: size }}>
            <GestureDetector gesture={gesture}>
              <Animated.View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="Meal turntable"
                accessibilityValue={{
                  text: `${dinner.name}, ${dinner.activeMinutes} minutes hands-on, ${dinner.totalMinutes} minutes total`,
                }}
                accessibilityHint="Turn the rim, then let go to spin for another meal."
                accessibilityActions={[
                  { name: "increment" },
                  { name: "decrement" },
                ]}
                onAccessibilityAction={spin}
                style={{ width: size, height: size }}
              >
                <Svg width={size} height={size} viewBox="0 0 400 400">
                  <Circle cx={200} cy={205} r={192} fill={colors.underside} />
                  <Circle cx={200} cy={200} r={192} fill={colors.disc} />
                </Svg>
                <Animated.View
                  pointerEvents="none"
                  className="absolute inset-0"
                  style={rimStyle}
                >
                  <Svg width={size} height={size} viewBox="0 0 400 400">
                    {WEDGES.map((_, index) => (
                      <Path
                        key={index}
                        d={wedge(index)}
                        fill={(dark ? DARK_WEDGES : WEDGES)[index]}
                      />
                    ))}
                    <Circle
                      cx={200}
                      cy={200}
                      r={188}
                      fill="none"
                      stroke={colors.shine}
                      strokeOpacity={0.3}
                      strokeWidth={3}
                    />
                    <Circle cx={200} cy={16} r={5} fill={colors.ink} />
                  </Svg>
                </Animated.View>
                <View pointerEvents="none" className="absolute inset-0">
                  <Svg width={size} height={size} viewBox="0 0 400 400">
                    <Circle cx={200} cy={200} r={149} fill={colors.disc} />
                    <Circle
                      cx={200}
                      cy={200}
                      r={146}
                      fill="none"
                      stroke={colors.shine}
                      strokeOpacity={0.3}
                      strokeWidth={2}
                    />
                  </Svg>
                </View>
                <View
                  pointerEvents="none"
                  className="absolute"
                  style={{
                    left: size * 0.2,
                    top: size * 0.29,
                    width: size * 0.6,
                    height: size * 0.46,
                  }}
                >
                  <Svg width="100%" height="100%" viewBox="0 0 400 304">
                    <Path
                      d="M49 66 C82 22 150 13 213 21 C282 7 349 40 370 92 C397 151 370 222 319 254 C267 289 197 286 137 277 C74 278 27 239 24 181 C4 133 20 99 49 66 Z"
                      fill={colors.underside}
                      transform="translate(0 7)"
                    />
                    <Path
                      d="M49 59 C82 15 150 6 213 14 C282 0 349 33 370 85 C397 144 370 215 319 247 C267 282 197 279 137 270 C74 271 27 232 24 174 C4 126 20 92 49 59 Z"
                      fill={plate}
                    />
                    <Path
                      d="M62 71 C98 34 153 28 210 33 C273 20 330 48 350 91"
                      fill="none"
                      stroke={colors.shine}
                      strokeOpacity={0.32}
                      strokeWidth={5}
                      strokeLinecap="round"
                    />
                  </Svg>
                </View>
                <Animated.View
                  key={dinner.title}
                  entering={ARRIVE}
                  pointerEvents="none"
                  className="absolute items-center"
                  style={[
                    {
                      left: size * 0.16,
                      top: size * 0.255,
                      width: size * 0.68,
                    },
                    foodStyle,
                  ]}
                >
                  <DinnerFood
                    dinner={dinner}
                    width={size * 0.68}
                    height={size * 0.68 * 0.72}
                  />
                </Animated.View>
              </Animated.View>
            </GestureDetector>

            {!expanded
              ? axes.map((axis, index) => {
                  const angle = ((-90 + (index + 0.5) * 45) * Math.PI) / 180;
                  return (
                    <View
                      key={axis.id}
                      className="absolute"
                      style={{
                        left:
                          size / 2 + radius * Math.cos(angle) - tokenWidth / 2,
                        top:
                          size / 2 + radius * Math.sin(angle) - tokenHeight / 2,
                      }}
                    >
                      {token(axis, index, tokenWidth)}
                    </View>
                  );
                })
              : null}
          </View>
        </View>

        <Animated.View
          key={dinner.title}
          entering={ARRIVE}
          className="gap-2 px-6"
        >
          <Text className="text-center font-rounded text-3xl font-extrabold leading-9 text-primary">
            {dinner.name}
          </Text>
          <Text
            className="text-center text-sm text-muted-foreground"
            style={{ fontVariant: "tabular-nums" }}
          >
            {dinner.activeMinutes} min hands-on · {dinner.totalMinutes} min
            total
          </Text>
          <Text className="text-center text-base leading-6">
            {dinner.pitch}
          </Text>
        </Animated.View>

        {expanded ? (
          <View className="flex-row flex-wrap gap-3 px-6 pt-3">
            {axes.map((axis, index) => (
              <View key={axis.id} className="min-w-0 grow basis-[45%]">
                {token(axis, index, (windowWidth - 60) / 2)}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  },
);
