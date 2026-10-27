import {
  type HouseholdPerson,
  type IngredientAvoidance,
} from "@magpie/profile";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { saveProfileSection } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { useOnboarding } from "@/features/onboarding/provider";
import { saveAvoidanceEntry } from "@/features/profile/avoidance-entry";
import { AvoidanceForm } from "@/features/profile/avoidance-form";
import { FormError, FormScreen } from "@/features/profile/form";
import { ProfileEntryScreen } from "@/features/profile/profile-entry-screen";
import { useHousehold } from "@/features/profile/use-household";

function EditAvoidance({
  entries,
  people,
  onSave,
}: {
  entries: IngredientAvoidance[];
  people: HouseholdPerson[];
  onSave: (entries: IngredientAvoidance[]) => Promise<void>;
}) {
  const { index, ingredient, kind } = useLocalSearchParams<{
    index?: string;
    ingredient?: string;
    kind?: string;
  }>();
  const router = useRouter();
  const position = index === undefined ? null : Number(index);
  const [originals] = useState(entries);
  const [item, setItem] = useState<Partial<IngredientAvoidance>>(() =>
    position === null
      ? {
          ingredient: ingredient ?? "",
          kind: kind === "dislike" ? "dislike" : undefined,
          detail: "",
          person_ids: [],
        }
      : { ...originals[position] },
  );
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(remove = false) {
    if (busy) return;
    setAttempted(true);
    if (!remove && (!item.ingredient?.trim() || !item.kind)) return;
    setBusy(true);
    setError(null);
    try {
      const next = remove
        ? originals.filter((_, i) => i !== position)
        : saveAvoidanceEntry(originals, position, item);
      await onSave(next);
      router.back();
    } catch {
      setError("Could not save this entry. Your changes are still here.");
    } finally {
      setBusy(false);
    }
  }
  if (
    position !== null &&
    (!Number.isInteger(position) || !originals[position])
  )
    return (
      <FormScreen>
        <Text>This entry is no longer in your list.</Text>
      </FormScreen>
    );
  return (
    <ProfileEntryScreen
      title={position === null ? "Add a food to avoid" : "Edit food to avoid"}
      busy={busy}
      error={error}
      onSave={() => void save()}
    >
      <AvoidanceForm
        item={item}
        people={people}
        onChange={setItem}
        attempted={attempted}
      />
      {position !== null ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          className="min-h-11 justify-center self-start"
          onPress={() => void save(true)}
        >
          <Text className="font-medium text-destructive">Remove entry</Text>
        </Pressable>
      ) : null}
    </ProfileEntryScreen>
  );
}

export function EditSetupAvoidance() {
  const { draft, commit } = useOnboarding();
  if (!draft) return <Redirect href="/setup" />;
  return (
    <EditAvoidance
      entries={draft.profile.ingredient_avoidances}
      people={draft.people}
      onSave={(ingredient_avoidances) =>
        commit((d) => ({
          ...d,
          profile: { ...d.profile, ingredient_avoidances },
        }))
      }
    />
  );
}
export function EditHouseholdAvoidance() {
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  if (!household || !listId)
    return (
      <FormScreen>
        <FormError message={error} />
        <Text>Loading…</Text>
      </FormScreen>
    );
  return (
    <EditAvoidance
      entries={household.profile.ingredient_avoidances}
      people={household.people}
      onSave={(ingredient_avoidances) =>
        saveProfileSection(listId, { ingredient_avoidances })
      }
    />
  );
}
