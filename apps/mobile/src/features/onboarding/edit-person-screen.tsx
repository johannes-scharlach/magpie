import { newPerson, personSchema, type HouseholdPerson } from "@magpie/profile";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useOnboarding } from "@/features/onboarding/provider";
import { PersonFields } from "@/features/profile/form";
import { ProfileEntryScreen } from "@/features/profile/profile-entry-screen";

export function EditSetupPerson() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { draft, commit } = useOnboarding();
  const existing = draft?.people.find((person) => person.id === id);
  const [person, setPerson] = useState<HouseholdPerson>(
    () => existing ?? newPerson(Crypto.randomUUID()),
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    const parsed = personSchema.safeParse(person);
    if (!parsed.success) {
      setValidationAttempt((value) => value + 1);
      const issue = parsed.error.issues[0];
      setFieldErrors(issue ? { [String(issue.path[0])]: issue.message } : {});
      return;
    }
    setBusy(true);
    try {
      await commit((draft) => ({
        ...draft,
        people: draft.people.some((entry) => entry.id === person.id)
          ? draft.people.map((entry) =>
              entry.id === person.id ? parsed.data : entry,
            )
          : [...draft.people, parsed.data],
      }));
      router.back();
    } catch {
      setError("Could not save this person. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing || existing.id === draft?.onboarding_person_id) return;
    setBusy(true);
    try {
      await commit((draft) => ({
        ...draft,
        people: draft.people.filter((entry) => entry.id !== existing.id),
      }));
      router.back();
    } catch {
      setError("Could not remove this person. Try again.");
      setBusy(false);
    }
  }

  const title = existing ? `${existing.name}’s meals` : "Add a person";
  const removeButton =
    existing && existing.id !== draft?.onboarding_person_id ? (
      <Button variant="ghost" disabled={busy} onPress={() => void remove()}>
        <Text className="text-destructive">Remove person</Text>
      </Button>
    ) : null;

  return (
    <ProfileEntryScreen
      title={title}
      busy={busy}
      error={error}
      onSave={() => void save()}
    >
      <PersonFields
        person={person}
        onChange={setPerson}
        errors={fieldErrors}
        validationAttempt={validationAttempt}
      />
      {removeButton}
    </ProfileEntryScreen>
  );
}
