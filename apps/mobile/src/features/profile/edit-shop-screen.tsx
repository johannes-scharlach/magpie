import { profileShops, type Shop } from "@magpie/profile";
import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryAction } from "@/components/action";
import { Text } from "@/components/ui/text";
import { saveProfileSection } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { useOnboarding } from "@/features/onboarding/provider";
import { ScrollEdgeFade } from "@/features/onboarding/scroll-edge-fade";
import { FormError, FormScreen } from "@/features/profile/form";
import { ShopForm } from "@/features/profile/shop-form";
import {
  saveShopEntry,
  shopChanges,
  type ShopsProfile,
} from "@/features/profile/shop-entry";
import { useHousehold } from "@/features/profile/use-household";

function EditShopScreen({
  profile,
  index,
  initialName,
  onSave,
}: {
  profile: ShopsProfile;
  index: number | null;
  initialName?: string;
  onSave: (shops: Shop[]) => void | Promise<void>;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shops] = useState(() => profileShops(profile));
  const [shop, setShop] = useState<Shop | undefined>(() => {
    const initial = index === null ? { name: initialName ?? "" } : shops[index];
    return initial ? { ...initial } : undefined;
  });
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);

  async function save() {
    if (busy || !shop) return;
    setValidationAttempt((value) => value + 1);
    if (!shop.name.trim() || !shop.rule) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(saveShopEntry(shops, index, shop));
      router.back();
    } catch {
      setError("Could not save this shop. Your changes are still here.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || index === null) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(shops.filter((_, row) => row !== index));
      router.back();
    } catch {
      setError("Could not remove this shop. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!shop)
    return (
      <FormScreen>
        <Text>This shop is no longer in your list.</Text>
      </FormScreen>
    );

  const title = index === null ? "Add a shop" : "Edit shop";
  const footer = (
    <View
      className="gap-3 px-6 pt-3"
      style={{ paddingBottom: Math.max(insets.bottom, 14) }}
      onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
    >
      <ScrollEdgeFade height={footerHeight} />
      <FormError message={error} />
      <PrimaryAction
        label={busy ? "Saving…" : "Save"}
        disabled={busy}
        onPress={() => void save()}
      />
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title,
          // Android sheets need the native footer slot to dock at the current detent.
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
        bottomOffset={footerHeight - Math.max(insets.bottom, 14) + 36}
        contentContainerClassName="gap-6 px-6 pt-5"
        contentContainerStyle={{ paddingBottom: footerHeight + 24 }}
      >
        {Platform.OS === "android" ? (
          <View className="gap-2">
            <View className="h-1 w-10 self-center rounded-full bg-border" />
            <View className="flex-row items-center justify-between gap-4">
              <Text
                accessibilityRole="header"
                className="font-rounded text-lg font-bold"
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
        <ShopForm
          shop={shop}
          onChange={setShop}
          validationAttempt={validationAttempt}
        />
        {index !== null ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            className="min-h-11 self-start justify-center"
            onPress={() => void remove()}
          >
            <Text className="font-medium text-destructive">Remove shop</Text>
          </Pressable>
        ) : null}
      </KeyboardAwareScrollView>
      {Platform.OS === "ios" ? (
        <KeyboardStickyView
          className="absolute bottom-0 left-0 right-0"
          offset={{ opened: Math.max(insets.bottom, 14) - 8 }}
        >
          {footer}
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}

export function EditSetupShop() {
  const { index, name } = useLocalSearchParams<{
    index?: string;
    name?: string;
  }>();
  const { draft, commit } = useOnboarding();
  if (!draft) return <Redirect href="/setup" />;
  const position = index === undefined ? null : Number(index);
  return (
    <EditShopScreen
      key={index}
      profile={draft.profile}
      index={position}
      initialName={name}
      onSave={(shops) =>
        commit((d) => ({
          ...d,
          profile: {
            ...d.profile,
            ...shopChanges(shops),
          },
        }))
      }
    />
  );
}

export function EditHouseholdShop() {
  const { index, name } = useLocalSearchParams<{
    index?: string;
    name?: string;
  }>();
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  if (!household || !listId) {
    return (
      <FormScreen>
        <FormError message={error} />
        <Text>Loading…</Text>
      </FormScreen>
    );
  }
  const position = index === undefined ? null : Number(index);
  return (
    <EditShopScreen
      key={index}
      profile={household.profile}
      index={position}
      initialName={name}
      onSave={(shops) => saveProfileSection(listId, shopChanges(shops))}
    />
  );
}
