import { Stack, useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryAction } from "@/components/action";
import { Text } from "@/components/ui/text";
import { ScrollEdgeFade } from "@/features/onboarding/scroll-edge-fade";
import { FormError } from "@/features/profile/form";

/** A single saved entry. Cancel and native dismissal never apply local edits. */
export function ProfileEntryScreen({
  title,
  children,
  onSave,
  busy = false,
  error,
}: {
  title: string;
  children: ReactNode;
  onSave: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(0);
  const bottom = Math.max(insets.bottom, 14);
  const footer = (
    <View
      className="gap-3 px-6 pt-3"
      style={{ paddingBottom: bottom }}
      onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
    >
      <ScrollEdgeFade height={footerHeight} />
      <FormError message={error} />
      <PrimaryAction
        label={busy ? "Saving…" : "Save"}
        disabled={busy}
        onPress={onSave}
      />
    </View>
  );
  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title,
          headerShown: Platform.OS === "ios",
          headerTransparent: false,
          gestureEnabled: !busy,
          unstable_sheetFooter:
            Platform.OS === "android" ? () => footer : undefined,
        }}
      />
      {Platform.OS === "ios" ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button disabled={busy} onPress={() => router.back()}>
            Cancel
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <KeyboardAwareScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bottomOffset={footerHeight - bottom + 36}
        contentContainerClassName="gap-6 px-6 pt-5"
        contentContainerStyle={{ paddingBottom: footerHeight + 24 }}
      >
        {Platform.OS === "android" ? (
          <View className="gap-2">
            <View className="h-1 w-10 self-center rounded-full bg-border" />
            <View className="flex-row items-center justify-between gap-4">
              <Text
                accessibilityRole="header"
                className="flex-1 font-rounded text-lg font-bold"
              >
                {title}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                className="min-h-11 justify-center"
                onPress={() => router.back()}
              >
                <Text className="font-medium text-primary">Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {children}
      </KeyboardAwareScrollView>
      {Platform.OS === "ios" ? (
        <KeyboardStickyView
          className="absolute bottom-0 left-0 right-0"
          offset={{ opened: bottom - 8 }}
        >
          {footer}
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}
