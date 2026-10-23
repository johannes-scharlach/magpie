import { useEffect, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { saveProfileSection } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { CuisineList } from "@/features/profile/cuisine-list";
import { type Cupboards } from "@/features/profile/cuisines";
import { FormError } from "@/features/profile/form";
import { useHousehold } from "@/features/profile/use-household";

export default function HouseholdCuisines() {
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Quick taps can outpace the local query; each edit builds on the last one.
  const latest = useRef<Cupboards | null>(null);
  useEffect(() => {
    if (household) latest.current = household.profile;
  }, [household]);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerClassName="gap-6 px-6 pb-10 pt-4"
    >
      <FormError message={saveError ?? error} />
      {household && listId ? (
        <CuisineList
          profile={household.profile}
          change={(edit) => {
            const next = edit(latest.current ?? household.profile);
            latest.current = next;
            saveProfileSection(listId, {
              keeps: next.keeps,
              cuisines: next.cuisines,
              extras: next.extras,
            }).then(
              () => setSaveError(null),
              () => setSaveError("Could not save. Try again."),
            );
          }}
        />
      ) : null}
    </ScrollView>
  );
}
