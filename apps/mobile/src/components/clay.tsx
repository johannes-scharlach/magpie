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

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/**
 * Magpie's material is clay: rounded heavy type, soft squircle tiles, art
 * that stands on the tile and spills over its edge. Fill contrast separates
 * tiles; drop shadows read as web.
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
