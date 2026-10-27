import { newPerson, personSchema, type HouseholdPerson } from "@magpie/profile";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { Text } from "@/components/ui/text";
import { removePerson, savePerson } from "@/db/profiles";
import { useHouseholdAccess } from "@/features/onboarding/access";
import { FormError, FormScreen, PersonFields } from "@/features/profile/form";
import { useHousehold } from "@/features/profile/use-household";
import { Action } from "@/components/action";
import { ProfileEntryScreen } from "@/features/profile/profile-entry-screen";

export default function ProfilePerson() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { listId } = useHouseholdAccess();
  const { household, error } = useHousehold(listId);
  if (!household || !listId)
    return (
      <FormScreen>
        <FormError message={error} />
        <Text>Loading…</Text>
      </FormScreen>
    );
  const person = household.people.find((p) => p.id === id);
  if (id && !person)
    return (
      <FormScreen>
        <Text>This person is no longer in the household.</Text>
      </FormScreen>
    );
  return (
    <PersonEditor
      key={`${listId}:${id ?? "new"}`}
      initial={person}
      listId={listId}
    />
  );
}
function PersonEditor({
  initial,
  listId,
}: {
  initial?: HouseholdPerson;
  listId: string;
}) {
  const [person, setPerson] = useState(
    () => initial ?? newPerson(Crypto.randomUUID()),
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function commit(remove = false) {
    if (busy) return;
    if (!remove) {
      const parsed = personSchema.safeParse(person);
      if (!parsed.success) {
        setValidationAttempt((value) => value + 1);
        const issue = parsed.error.issues[0];
        setFieldErrors(issue ? { [String(issue.path[0])]: issue.message } : {});
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      if (remove) await removePerson(listId, person.id);
      else await savePerson(listId, person);
      router.back();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save this person. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <ProfileEntryScreen
      title={initial ? `${initial.name}’s meals` : "Add a person"}
      busy={busy}
      error={error}
      onSave={() => void commit()}
    >
      <PersonFields
        person={person}
        onChange={setPerson}
        errors={fieldErrors}
        validationAttempt={validationAttempt}
      />
      {initial && (
        <Action
          destructive
          label="Remove person"
          disabled={busy}
          onPress={() =>
            Alert.alert(
              "Remove this person?",
              `${person.name} will no longer be included when Magpie plans meals. Existing recipes and plans stay unchanged.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () => void commit(true),
                },
              ],
            )
          }
        />
      )}
    </ProfileEntryScreen>
  );
}
