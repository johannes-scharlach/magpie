import { Host } from "@expo/ui";
import {
  cuisineLabel,
  keptLabels,
  dietRequests,
  selectionLabels,
  shopRuleSummaries,
  profileShops,
  stapleGroups,
  measurementSystemOptions,
  temperatureOptions,
  type SelectionField,
} from "@magpie/profile";
import { useNavigation, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useLayoutEffect } from "react";
import { Alert, Pressable } from "react-native";
import { useResolveClassNames } from "uniwind";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import {
  useActiveList,
  useHouseholdAccess,
} from "@/features/onboarding/access";
import { supabase } from "@/lib/supabase";
import { FormError, FormScreen } from "@/features/profile/form";
import {
  SettingsList,
  SettingsRow,
  SettingsSection,
} from "@/features/profile/settings-list";
import { useHousehold } from "@/features/profile/use-household";
import { unregisterPushDevice } from "@/features/notifications/notifications";
import { avoidanceSummary } from "@/features/profile/avoidance-entry";

// Pantry and fresh staples are no longer asked; cuisines replace them.
const selectionTitles: Partial<Record<SelectionField, string>> = {
  goals: "Cooking rules",
  kitchen_equipment: "Equipment",
};
const SWITCH_ICON = {
  ios: "arrow.left.arrow.right.circle",
  android: "swap_horiz",
} as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  const list = useActiveList();
  const backgroundColor = useResolveClassNames("bg-background").backgroundColor;
  const primaryColor = useResolveClassNames("bg-primary").backgroundColor;
  const iconColor = useResolveClassNames("text-foreground").color;
  const navigation = useNavigation();
  const name = list?.name;
  // The header belongs to the root stack's "household" screen, so the title
  // (the household this screen is about) is set on the parent.
  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({
      title: name ?? "Household",
      headerRight: () => (
        <Pressable
          onPress={() => router.push("/household/switch")}
          hitSlop={8}
          accessibilityLabel="Switch household"
          accessibilityRole="button"
          className="p-2"
        >
          <SymbolView
            name={SWITCH_ICON}
            tintColor={typeof iconColor === "string" ? iconColor : undefined}
            size={24}
          />
        </Pressable>
      ),
    });
  }, [navigation, router, name, iconColor]);
  if (!household)
    return (
      <FormScreen>
        <FormError message={error} />
        <Text>Loading your household…</Text>
      </FormScreen>
    );
  return (
    <Host
      style={{ flex: 1, backgroundColor }}
      seedColor={primaryColor}
      useViewportSizeMeasurement
    >
      <SettingsList>
        <SettingsSection title="People to plan for">
          {household.people.map((p) => (
            <SettingsRow
              key={p.id}
              onPress={() =>
                router.push({
                  pathname: "/household/person",
                  params: { id: p.id },
                })
              }
              detail={[
                p.age_group,
                `${p.portion_reference}× helping`,
                p.diet === "other" ? p.diet_other : dietRequests[p.diet],
                // "Always" is the default; only say it when it's not.
                p.meal_times && p.meal_times !== "Always"
                  ? `Usually here: ${p.meal_times}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              title={
                p.user_id === session?.user.id ? `${p.name} (You)` : p.name
              }
            />
          ))}
          <SettingsRow
            title="Add a person"
            onPress={() => router.push("/household/person")}
          />
          <SettingsRow
            title="Invite to household"
            onPress={() => router.push("/household/invite")}
          />
        </SettingsSection>
        <SettingsSection title="Cooking">
          <SettingsRow
            detail={
              [
                ...household.profile.ingredient_avoidances.map(
                  (item) =>
                    `${item.ingredient} (${avoidanceSummary(item, household.people)})`,
                ),
                household.profile.restrictions,
              ]
                .filter(Boolean)
                .join(", ") || "None added"
            }
            onPress={() => router.push("/household-avoidances")}
            title="Foods to leave out"
          />
          <SettingsRow
            detail={household.profile.meals_at_home || "Not specified"}
            onPress={() => router.push("/household/meals_at_home")}
            title="Meals to plan"
          />
          {(Object.keys(selectionTitles) as SelectionField[]).map((key) => (
            <SettingsRow
              key={key}
              detail={
                selectionLabels(key, household.profile[key]).join(", ") ||
                "None selected"
              }
              onPress={() => router.push(`/household/${key}`)}
              title={selectionTitles[key]!}
            />
          ))}
          <SettingsRow
            detail={`${measurementSystemOptions[household.profile.measurements.system]} · ${temperatureOptions[household.profile.measurements.temperature]}`}
            onPress={() => router.push("/household/measurements")}
            title="Measurements"
          />
          <SettingsRow
            detail={
              household.profile.cuisines.map(cuisineLabel).join(", ") ||
              "None added"
            }
            onPress={() => router.push("/household-cuisines")}
            title="Familiar cooking"
          />
          <SettingsRow
            detail={
              [
                ...new Set(
                  [...stapleGroups, ...household.profile.cuisines].flatMap(
                    (group) => keptLabels(household.profile, group),
                  ),
                ),
              ].join(", ") || "None added"
            }
            onPress={() =>
              router.push({
                pathname: "/household-cuisines",
                params: { part: "staples" },
              })
            }
            title="Usual ingredients"
          />
        </SettingsSection>
        <SettingsSection title="Shopping">
          <SettingsRow
            detail={
              [
                ...profileShops(household.profile).map(
                  (shop) =>
                    `${shop.name} · ${shop.rule ? shopRuleSummaries[shop.rule] : "Choose a rule"}`,
                ),
                household.profile.other_shops,
              ]
                .filter(Boolean)
                .join(", ") || "Not specified"
            }
            onPress={() => router.push("/household-shops")}
            title="Shops"
          />
        </SettingsSection>
        <SettingsSection title="Account">
          <SettingsRow
            title="Notifications"
            detail="Household updates"
            onPress={() =>
              router.push({
                pathname: "/notifications",
                params: { source: "settings" },
              })
            }
          />
          <SettingsRow title="Email" detail={session?.user.email} />
          <SettingsRow title="Sign out" destructive onPress={confirmSignOut} />
        </SettingsSection>
      </SettingsList>
    </Host>
  );
}

function confirmSignOut() {
  Alert.alert("Sign out?", "You can sign back in with your email.", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Sign out",
      style: "destructive",
      onPress: () => void signOut(),
    },
  ]);
}

async function signOut() {
  try {
    await unregisterPushDevice();
  } catch (error) {
    // Signing out still wins. A reassigned installation is disabled again when
    // the next account registers it; server eligibility also checks ownership.
    console.error("Could not unregister push device before sign out", error);
  }
  await supabase.auth.signOut();
}
