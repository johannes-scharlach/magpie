import { Host, RNHostView } from "@expo/ui";
import { BottomSheet, Group } from "@expo/ui/swift-ui";
import {
  frame,
  padding,
  presentationDetents,
  presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";
import {
  useImperativeHandle,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { View, useWindowDimensions, type TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CloseButton } from "@/components/close-button";
import { Text } from "@/components/ui/text";

export type EditorSheetHandle = { dismiss: () => void };

/** Native sheet fitted tightly to content with glassmorphism background. */
export function EditorSheet({
  ref,
  title,
  onDismiss,
  children,
}: {
  ref?: Ref<EditorSheetHandle>;
  title: string;
  onDismiss: () => void;
  children: ReactNode;
  autoFocusInput?: RefObject<TextInput | null>;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 16);
  const [contentHeight, setContentHeight] = useState<number>(240);
  const [isPresented, setIsPresented] = useState(true);
  useImperativeHandle(ref, () => ({ dismiss: () => setIsPresented(false) }), []);

  return (
    <Host style={{ position: "absolute" }} pointerEvents="none">
      {/* Use SwiftUI's completion event, not the universal wrapper's state-change
          callback: the parent must stay mounted through the exit animation. */}
      <BottomSheet
        isPresented={isPresented}
        onIsPresentedChange={setIsPresented}
        onDismiss={onDismiss}
      >
        <Group
          modifiers={[
            frame({ maxWidth: Infinity, alignment: "topLeading" }),
            padding({ top: 12, bottom: bottomInset, leading: 24, trailing: 24 }),
            presentationDragIndicator("visible"),
            presentationDetents([{ height: Math.round(contentHeight) }]),
          ]}
        >
          <RNHostView matchContents>
            <View
              style={{ width: Math.min(width - 48, 540) }}
              className="gap-5"
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                const target = h + 12 + bottomInset + 16;
                if (h > 40 && Math.abs(contentHeight - target) > 4) {
                  setContentHeight(target);
                }
              }}
            >
              <View className="flex-row items-center justify-between gap-4">
                <Text
                  accessibilityRole="header"
                  className="flex-1 text-xl font-semibold"
                >
                  {title}
                </Text>
                <CloseButton onPress={() => setIsPresented(false)} />
              </View>
              {children}
            </View>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}
