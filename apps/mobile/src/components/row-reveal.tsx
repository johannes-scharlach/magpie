import { type ReactNode } from "react";
import Animated, {
  Easing,
  Keyframe,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";

/** Rows emerge from beneath the preceding content, like the cupboard reveal. */
export function RowReveal({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const entering = new Keyframe({
    0: { opacity: 0, transform: [{ translateY: reduced ? 0 : -12 }] },
    100: {
      opacity: 1,
      transform: [{ translateY: 0 }],
      easing: Easing.bezier(0.23, 1, 0.32, 1),
    },
  })
    .duration(reduced ? 100 : 250)
    .delay(reduced ? 0 : 250 + index * 80)
    .reduceMotion(ReduceMotion.Never);
  return <Animated.View entering={entering}>{children}</Animated.View>;
}
