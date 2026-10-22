import { Host, RNHostView } from "@expo/ui";
import {
  Column,
  ModalBottomSheet,
  type ModalBottomSheetRef,
} from "@expo/ui/jetpack-compose";
import {
  onGloballyPositioned,
  padding,
} from "@expo/ui/jetpack-compose/modifiers";
import {
  useImperativeHandle,
  useRef,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import {
  View,
  useWindowDimensions,
  type TextInputInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";
import { CloseButton } from "@/components/close-button";
import { Text } from "@/components/ui/text";
import type { EditorSheetHandle } from "./editor-sheet";

export function EditorSheet({
  ref,
  title,
  onDismiss,
  children,
  autoFocusInput,
}: {
  ref?: Ref<EditorSheetHandle>;
  title: string;
  onDismiss: () => void;
  children: ReactNode;
  autoFocusInput?: RefObject<TextInputInstance | null>;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const background = useResolveClassNames("bg-background").backgroundColor;
  const foreground = useResolveClassNames("text-foreground").color;
  const sheet = useRef<ModalBottomSheetRef>(null);
  const closing = useRef(false);
  const focusRequested = useRef(false);

  async function focusAfterPresentation() {
    if (focusRequested.current || !autoFocusInput || !sheet.current) return;
    focusRequested.current = true;
    // React children can lay out before the Compose dialog is ready. Start
    // from its native placement event and wait for expansion, not a timer.
    await sheet.current.expand();
    if (closing.current) return;
    // Native autoFocus may already have focused the field without a served
    // input connection. Refocusing asks the now-ready dialog to show the IME.
    autoFocusInput.current?.blur();
    autoFocusInput.current?.focus();
  }

  async function dismiss() {
    if (closing.current || !sheet.current) return;
    closing.current = true;
    await sheet.current.hide();
    onDismiss();
  }
  useImperativeHandle(ref, () => ({ dismiss: () => void dismiss() }));

  return (
    <Host style={{ position: "absolute" }} pointerEvents="none">
      {/* The universal height snap point allows a half-height state that hides
          form actions. Expand to the content's height, not the full screen. */}
      <ModalBottomSheet
        ref={sheet}
        onDismissRequest={onDismiss}
        skipPartiallyExpanded
        showDragHandle
        containerColor={background}
        contentColor={foreground}
      >
        <Column
          modifiers={[
            padding(24, 0, 24, Math.max(insets.bottom, 16)),
            // This modifier registers a native event; it doesn't call the handler during render.
            // eslint-disable-next-line react-hooks/refs
            onGloballyPositioned(() => void focusAfterPresentation()),
          ]}
        >
          <RNHostView matchContents>
            <View
              style={{ width: Math.min(width - 48, 540) }}
              className="gap-5"
            >
              <View className="flex-row items-center justify-between gap-4">
                <Text
                  accessibilityRole="header"
                  className="flex-1 text-xl font-semibold"
                >
                  {title}
                </Text>
                <CloseButton onPress={() => void dismiss()} />
              </View>
              {children}
            </View>
          </RNHostView>
        </Column>
      </ModalBottomSheet>
    </Host>
  );
}
