import { Host } from "@expo/ui";
import type { HostProps } from "@expo/ui/swift-ui";
import { useRef, type ComponentProps } from "react";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const RESIZE_SPRING = {
  duration: 400,
  dampingRatio: 1,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
};

// The universal Host reexports SwiftUI on iOS, but its shared types omit alignment.
const ALIGNMENT = {
  alignment: "topLeading",
} satisfies Pick<HostProps, "alignment">;

export function CollapsibleHost(
  props: Pick<ComponentProps<typeof Host>, "children" | "seedColor">,
) {
  const targetHeight = useRef<number | undefined>(undefined);
  const height = useSharedValue<number | undefined>(undefined);
  const style = useAnimatedStyle(() => ({ height: height.get() }));

  return (
    // Animate occupied space, not scale: the card and following sections must reflow.
    <Animated.View style={style}>
      <Host
        {...props}
        {...ALIGNMENT}
        matchContents={{ vertical: true }}
        onLayoutContent={({ nativeEvent }) => {
          const next = nativeEvent.height;
          if (targetHeight.current === next) return;
          const firstLayout = targetHeight.current === undefined;
          targetHeight.current = next;
          height.set(firstLayout ? next : withSpring(next, RESIZE_SPRING));
        }}
      />
    </Animated.View>
  );
}
