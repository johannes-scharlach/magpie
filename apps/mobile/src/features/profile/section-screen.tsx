import {
  selectionOptions,
  type CookingProfile,
  type SelectionField,
} from "@magpie/profile";
import { Redirect, useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { CloseButton } from "@/components/close-button";
import { PrimaryAction } from "@/components/action";
import { Text } from "@/components/ui/text";
import { saveProfileSection } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { FormError, MealRoutineEditor } from "@/features/profile/form";
import { useHousehold } from "@/features/profile/use-household";
import { ChoiceTiles } from "@/features/profile/choice-tiles";

const titles: Record<string, string> = {
  goals: "Cooking rules",
  kitchen_equipment: "Equipment",
  meals_at_home: "Meals to plan",
};

function SectionForm({
  section,
  busy = false,
  children,
}: {
  section: string;
  busy?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    // Keep the main ScrollView directly under the native sheet content wrapper.
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-6 px-6 pt-4"
    >
      <View className="flex-row items-center justify-between gap-4">
        <Text className="flex-1 font-rounded text-lg font-bold">
          {titles[section] ?? "Profile"}
        </Text>
        <CloseButton onPress={() => router.back()} disabled={busy} />
      </View>
      {children}
    </ScrollView>
  );
}

export function ProfileSectionScreen({ section }: { section: string }) {
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  if (section === "restrictions")
    return <Redirect href="/household-avoidances" />;
  if (!household || !listId)
    return (
      <SectionForm section={section}>
        <FormError message={error} />
        <Text>Loading…</Text>
      </SectionForm>
    );
  if (!titles[section])
    return (
      <SectionForm section={section}>
        <Text>Unknown Profile section.</Text>
      </SectionForm>
    );
  return (
    <SectionEditor
      key={`${listId}:${section}`}
      initial={household.profile}
      listId={listId}
      section={section}
    />
  );
}
function SectionEditor({
  initial,
  listId,
  section,
}: {
  initial: CookingProfile;
  listId: string;
  section: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selection =
    section in selectionOptions ? (section as SelectionField) : null;
  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const changes = selection
        ? { [selection]: draft[selection] }
        : { meals_at_home: draft.meals_at_home };
      await saveProfileSection(listId, changes);
      router.back();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Your changes are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SectionForm section={section} busy={busy}>
      <FormError message={error} />
      {selection && (
        <ChoiceTiles
          field={selection}
          value={draft[selection]}
          onChange={(value) => setDraft((d) => ({ ...d, [selection]: value }))}
        />
      )}
      {section === "kitchen_equipment" ? (
        <Text className="text-muted-foreground">
          Magpie will choose cooking methods that work with this equipment.
        </Text>
      ) : null}
      {section === "meals_at_home" && (
        <MealRoutineEditor
          value={draft.meals_at_home}
          onChange={(meals_at_home) =>
            setDraft((d) => ({ ...d, meals_at_home }))
          }
        />
      )}
      <PrimaryAction
        label={busy ? "Saving…" : "Save"}
        disabled={busy}
        onPress={() => void save()}
      />
    </SectionForm>
  );
}
