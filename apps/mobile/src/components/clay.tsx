import { useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import Animated, {
  cubicBezier,
  useReducedMotion,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/**
 * Magpie's material is clay: rounded heavy type, soft squircle tiles, art
 * that stands on the tile and spills over its edge. Fill contrast separates
 * tiles; drop shadows read as web.
 * Selected clay surfaces use accent with primary text; plum fills belong
 * to actions, not whole selected cards. Press feedback is scale, not colour.
 */
// Text uses the `font-rounded` class (src/global.css); native headers need
// the family name itself.
const ROUNDED = Platform.select({ ios: "ui-rounded", default: "Nunito" });

/** Spread into a Stack's screenOptions. */
export const roundedHeader = {
  headerTitleStyle: { fontFamily: ROUNDED, fontWeight: "700" },
  headerLargeTitleStyle: { fontFamily: ROUNDED, fontWeight: "800" },
} as const;

export const clayTile: ViewStyle = {
  borderRadius: 28,
  borderCurve: "continuous",
};

// Visual prototype: five pressed-clay pebbles, not containers for the artwork.
// Broad, smooth curves keep the irregularity quiet rather than wobbly.
const PEBBLES = [
  "M57 6 C80 3 106 12 114 31 C122 50 114 72 96 81 C78 90 53 86 32 85 C11 84 2 70 4 49 C6 28 34 9 57 6 Z",
  "M65 5 C88 8 109 19 115 38 C121 57 106 79 84 84 C62 89 44 87 24 80 C4 73 1 52 10 34 C19 16 42 2 65 5 Z",
  "M51 8 C75 3 96 7 109 24 C122 41 119 62 102 76 C85 90 61 87 39 85 C17 83 4 72 4 52 C4 32 27 13 51 8 Z",
  "M61 4 C81 4 107 16 113 35 C119 54 114 72 94 82 C74 92 48 84 28 80 C8 76 0 60 7 40 C14 20 41 4 61 4 Z",
  "M49 7 C71 1 96 7 110 26 C124 45 116 65 98 78 C80 91 55 89 33 82 C11 75 0 62 5 43 C10 24 27 13 49 7 Z",
] as const;

/** The same item keeps its pebble across selection, reordering and screens. */
export function ClayPebble({ seed }: { seed: string }) {
  const fill = useResolveClassNames("bg-accent").backgroundColor;
  let hash = 0;
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 120 90"
      preserveAspectRatio="none"
      accessible={false}
    >
      <Path d={PEBBLES[hash % PEBBLES.length]} fill={fill} />
    </Svg>
  );
}

/** Resting angles, fixed so selections never reshuffle the composition. */
export const clayTilts = [-2, 1.5, -1, 2, -1.5, 1] as const;

export function SectionTitle({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <Text
      role="heading"
      className={cn(
        "font-rounded text-2xl font-extrabold text-primary",
        className,
      )}
    >
      {children}
    </Text>
  );
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Press feedback for tiles: a quick 3% give, no bounce. Touched tens of
 * times a day, so it stays near-imperceptible; the screen it opens is the
 * real response, so no haptic. `tilt` keeps a tile's resting angle.
 */
export function PressableScale({
  children,
  tilt = 0,
  ...props
}: Omit<PressableProps, "children"> & { children: ReactNode; tilt?: number }) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();
  const scale = pressed && !reduced ? 0.97 : 1;
  return (
    <Pressable
      pressRetentionOffset={16}
      {...props}
      onPressIn={(e) => {
        setPressed(true);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        props.onPressOut?.(e);
      }}
    >
      <Animated.View
        style={{
          transform: [{ rotate: `${tilt}deg` }, { scale }],
          transitionProperty: "transform",
          transitionDuration: 120,
          transitionTimingFunction: cubicBezier(...EASE_OUT),
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
