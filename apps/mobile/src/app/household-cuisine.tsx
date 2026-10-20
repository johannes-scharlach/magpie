import { useEffect, useRef, useState } from "react";
import { saveProfileSection } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import {
  CupboardScreen,
  type Cupboards,
} from "@/features/profile/cupboard-screen";
import { useHousehold } from "@/features/profile/use-household";

export default function EditHouseholdCuisine() {
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Quick taps can outpace the local query; each edit builds on the last one.
  const latest = useRef<Cupboards | null>(null);
  useEffect(() => {
    if (household) latest.current = household.profile;
  }, [household]);
  if (!household || !listId) return null;
  return (
    <CupboardScreen
      profile={household.profile}
      change={(edit) => {
        const next = edit(latest.current ?? household.profile);
        latest.current = next;
        saveProfileSection(listId, {
          keeps: next.keeps,
          cuisines: next.cuisines,
        }).then(
          () => setSaveError(null),
          () => setSaveError("Could not save. Try again."),
        );
      }}
      error={saveError ?? error}
      layout="page"
    />
  );
}
