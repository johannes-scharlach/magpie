import {
  profileShops,
  type CookingProfile,
  type HouseholdPerson,
} from "@magpie/profile";
import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, View, type TextInputInstance } from "react-native";
import { AddRow } from "@/components/add-row";
import { type Step } from "@/features/onboarding/draft";
import { PersonRow } from "@/features/onboarding/person-row";
import { personSummary } from "@/features/onboarding/person-summary";
import { useOnboarding } from "@/features/onboarding/provider";
import { DietEditor, Field, MealRoutineEditor } from "@/features/profile/form";
import { ChoiceTiles } from "@/features/profile/choice-tiles";
import { AvoidancesEditor } from "@/features/profile/avoidances-editor";
import { ShopsEditor } from "@/features/profile/shops-editor";
import { CuisineList } from "@/features/profile/cuisine-list";
import { StaplesEditor } from "@/features/profile/staples-editor";
import { MeasurementsEditor } from "@/features/profile/measurements-editor";

export const titles: Record<Step, string> = {
  name: "What’s your name?",
  goals: "Set your cooking rules",
  diet: "How should Magpie plan your meals?",
  household: "Who do you usually cook for?",
  restrictions: "What should Magpie leave out?",
  groceries: "Where do you shop?",
  kitchen: "What can you cook with?",
  measurements: "Which measurements should Magpie use?",
  cuisines: "Which cuisines do you cook?",
  staples: "What do you usually keep?",
  email: "What’s your email?",
  code: "Check your inbox",
};

export const subtitles: Partial<
  Record<Exclude<Step, "email" | "code">, string>
> = {
  staples:
    "Foods you usually keep or buy—not a list of what’s in your kitchen today.",
};

function HouseholdEditor({
  people,
  currentPersonId,
  onAdd,
  onEdit,
  onRemove,
}: {
  people: HouseholdPerson[];
  currentPersonId: string;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View
      className="overflow-hidden rounded-xl border border-border bg-card"
      style={{ borderCurve: "continuous" }}
    >
      {people.map((person, index) => {
        const isCurrentPerson = person.id === currentPersonId;
        return (
          <View key={person.id}>
            {index > 0 ? (
              <View
                className={
                  Platform.OS === "ios"
                    ? "ml-4 border-t border-border"
                    : "border-t border-border"
                }
              />
            ) : null}
            <PersonRow
              name={
                isCurrentPerson
                  ? `${person.name.trim() || "You"} (You)`
                  : person.name.trim()
              }
              detail={personSummary(person)}
              onEdit={() => onEdit(person.id)}
              onRemove={isCurrentPerson ? undefined : () => onRemove(person.id)}
            />
          </View>
        );
      })}
      <AddRow label="Add a person" onPress={onAdd} />
    </View>
  );
}

export function SetupQuestion({
  step,
  onNext,
  validationAttempt,
  onRoutineInputHeightChange,
  active,
}: {
  step: Step;
  onNext: () => void;
  /** Continue was tapped with a required answer missing. */
  validationAttempt: number;
  onRoutineInputHeightChange?: (height: number) => void;
  active: boolean;
}) {
  const router = useRouter();
  const focused = useIsFocused();
  const { draft, update, commit } = useOnboarding();
  const nameRef = useRef<TextInputInstance>(null);
  const openedFirstShop = useRef(false);
  const showErrors = validationAttempt > 0;
  // Mounted on the step it opens at, so resuming elsewhere stays quiet.
  const [openedHere] = useState(() => draft?.step === step);
  useEffect(() => {
    if (showErrors && step === "name") nameRef.current?.focus();
  }, [showErrors, step, validationAttempt]);
  useEffect(() => {
    if (
      step !== "groceries" ||
      !active ||
      !focused ||
      !draft ||
      openedFirstShop.current ||
      profileShops(draft.profile).length
    )
      return;
    // Enter the first detail once, not the pager's look-ahead page or again after Cancel.
    openedFirstShop.current = true;
    router.push("/setup/shop");
  }, [active, focused, draft, router, step]);
  if (!draft) return null;
  const person = draft.people.find((p) => p.id === draft.onboarding_person_id)!;
  const CuisineEditor = step === "staples" ? StaplesEditor : CuisineList;
  function editProfile(changes: Partial<CookingProfile>) {
    void update((d) => ({ ...d, profile: { ...d.profile, ...changes } })).catch(
      () => {},
    );
  }
  function editPerson(value: HouseholdPerson) {
    void update((d) => ({
      ...d,
      people: d.people.map((p) => (p.id === value.id ? value : p)),
    })).catch(() => {});
  }
  return (
    <>
      {step === "name" ? (
        <Field
          ref={nameRef}
          label="What should Magpie call you?"
          hideLabel
          placeholder="Name or nickname"
          value={person.name}
          onChangeText={(name) => editPerson({ ...person, name })}
          error={showErrors && !person.name.trim() ? "Enter a name." : null}
          autoFocus={openedHere}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          onSubmitEditing={onNext}
        />
      ) : null}
      {step === "goals" ? (
        <ChoiceTiles
          field="goals"
          value={draft.profile.goals}
          onChange={(goals) => editProfile({ goals })}
        />
      ) : null}
      {step === "diet" ? (
        <DietEditor
          person={person}
          onChange={editPerson}
          allowOtherDiet
          validationAttempt={validationAttempt}
          otherError={
            showErrors && person.diet === "other" && !person.diet_other.trim()
              ? "Say what Magpie should reduce, leave out or replace."
              : null
          }
        />
      ) : null}
      {step === "household" ? (
        <View className="gap-6">
          <HouseholdEditor
            currentPersonId={person.id}
            people={draft.people}
            onAdd={() => router.push("/setup/person" as never)}
            onEdit={(id) =>
              router.push({
                pathname: "/setup/person",
                params: { id },
              } as never)
            }
            onRemove={(id) =>
              void update((d) => ({
                ...d,
                people: d.people.filter((entry) => entry.id !== id),
              })).catch(() => {})
            }
          />
          <MealRoutineEditor
            value={draft.profile.meals_at_home}
            onChange={(meals_at_home) => editProfile({ meals_at_home })}
            onInputHeightChange={onRoutineInputHeightChange}
          />
        </View>
      ) : null}
      {step === "restrictions" ? (
        <AvoidancesEditor
          value={draft.profile.ingredient_avoidances}
          people={draft.people}
          onEdit={(index) =>
            router.push({ pathname: "/setup/avoidance", params: { index } })
          }
          onAdd={(ingredient, kind) =>
            router.push({
              pathname: "/setup/avoidance",
              params: {
                ...(ingredient ? { ingredient } : {}),
                ...(kind ? { kind } : {}),
              },
            })
          }
          notes={draft.profile.restrictions}
          onSaveNotes={(restrictions) =>
            commit((d) => ({ ...d, profile: { ...d.profile, restrictions } }))
          }
        />
      ) : null}
      {step === "groceries" ? (
        <ShopsEditor
          profile={draft.profile}
          onSaveNotes={(other_shops) =>
            commit((d) => ({ ...d, profile: { ...d.profile, other_shops } }))
          }
          onEdit={(index) =>
            router.push({ pathname: "/setup/shop", params: { index } })
          }
          onAdd={(name) =>
            router.push({
              pathname: "/setup/shop",
              params: name ? { name } : {},
            })
          }
          validationAttempt={validationAttempt}
        />
      ) : null}
      {step === "kitchen" ? (
        <ChoiceTiles
          field="kitchen_equipment"
          value={draft.profile.kitchen_equipment}
          onChange={(kitchen_equipment) => editProfile({ kitchen_equipment })}
        />
      ) : null}
      {step === "measurements" ? (
        <MeasurementsEditor
          value={draft.profile.measurements}
          onChange={(measurements) => editProfile({ measurements })}
        />
      ) : null}
      {step === "cuisines" || step === "staples" ? (
        <CuisineEditor
          profile={draft.profile}
          change={(edit) =>
            void update((d) => ({
              ...d,
              profile: { ...d.profile, ...edit(d.profile) },
            })).catch(() => {})
          }
        />
      ) : null}
    </>
  );
}
