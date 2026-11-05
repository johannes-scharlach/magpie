import {
  mealIdeasBrief,
  mealIdeasChanges,
  type CookingProfile,
} from "@magpie/profile";
import { useRouter } from "expo-router";
import { useState } from "react";
import { PrimaryAction } from "@/components/action";
import { Text } from "@/components/ui/text";
import { saveProfileSection } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { FormError, FormScreen } from "@/features/profile/form";
import { MealIdeasEditor } from "@/features/profile/meal-ideas-editor";
import { useHousehold } from "@/features/profile/use-household";

export function HouseholdHabitsScreen() {
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
  return (
    <MealIdeasForm key={listId} initial={household.profile} listId={listId} />
  );
}

function MealIdeasForm({
  initial,
  listId,
}: {
  initial: CookingProfile;
  listId: string;
}) {
  const router = useRouter();
  const [brief, setBrief] = useState(() => mealIdeasBrief(initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveProfileSection(listId, mealIdeasChanges(brief));
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your changes.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScreen>
      <FormError message={error} />
      <Text className="font-rounded text-xl font-bold">
        Which meals would you usually like ideas for?
      </Text>
      <MealIdeasEditor value={brief} onChange={setBrief} />
      <PrimaryAction
        label={busy ? "Saving…" : "Save"}
        disabled={busy}
        onPress={() => void save()}
      />
    </FormScreen>
  );
}
