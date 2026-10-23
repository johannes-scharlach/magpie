import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Action, PrimaryAction } from "@/components/action";
import { CloseButton } from "@/components/close-button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import { FormError } from "@/features/profile/form";
import {
  enableNotifications,
  markNotificationPrompted,
  notificationState,
  openNotificationSettings,
  type NotificationState,
} from "@/features/notifications/notifications";

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const { session } = useAuth();
  const [state, setState] = useState<NotificationState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prompted = source !== "settings";
  useEffect(() => {
    if (prompted && session) {
      void markNotificationPrompted(session.user.id);
    }
  }, [prompted, session]);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      function refresh() {
        void notificationState()
          .then((next) => {
            if (!active) return;
            setState(next);
            setError(null);
          })
          .catch((cause) => {
            if (!active) return;
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not load notification settings.",
            );
          });
      }
      refresh();
      // Returning from system Settings doesn't refocus the route.
      const subscription = AppState.addEventListener("change", (next) => {
        if (next === "active") refresh();
      });
      return () => {
        active = false;
        subscription.remove();
      };
    }, []),
  );
  async function finish() {
    if (session) await markNotificationPrompted(session.user.id);
    router.back();
  }
  async function allow() {
    if (busy || !state) return;
    setBusy(true);
    setError(null);
    try {
      if (state !== "not-asked") {
        await openNotificationSettings();
        return;
      }
      const enabled = await enableNotifications();
      setState(enabled ? "enabled" : "disabled");
      if (enabled) await finish();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not enable notifications.",
      );
    } finally {
      setBusy(false);
    }
  }
  const title =
    state === "enabled"
      ? "Notifications are on"
      : state === "disabled"
        ? "Notifications are off"
        : state === "not-asked"
          ? "Turn on notifications?"
          : "Notifications";

  return (
    <>
      <ScrollView
        className="bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-6 px-6 pt-4 pb-6"
        contentContainerStyle={
          Platform.OS === "android"
            ? { paddingBottom: Math.max(insets.bottom, 24) }
            : undefined
        }
      >
        {state ? (
          <Text selectable className="text-lg leading-7">
            {state === "enabled"
              ? "You can change them in Settings."
              : state === "disabled"
                ? "You can turn them on in Settings."
                : "We’ll send you meal reminders and let you know when a reply is ready or someone joins your household."}
          </Text>
        ) : !error ? (
          <ActivityIndicator className="my-8" />
        ) : null}
        <FormError message={error} />
        {state ? (
          <View className="gap-3">
            <PrimaryAction
              disabled={busy}
              label={
                state === "not-asked"
                  ? busy
                    ? "Turning on…"
                    : "Turn on notifications"
                  : busy
                    ? "Opening Settings…"
                    : "Open Settings"
              }
              onPress={() => void allow()}
            />
            {state === "not-asked" ? (
              <Action
                disabled={busy}
                label="Not now"
                onPress={() => void finish()}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <CloseButton disabled={busy} onPress={() => void finish()} />
          ),
        }}
      />
    </>
  );
}
