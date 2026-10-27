import {
  ageGroups,
  dietDescriptions,
  dietOptions,
  dietRequests,
  portionReferenceRange,
  type HouseholdPerson,
} from "@magpie/profile";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AppState,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { ChoiceList } from "@/components/choice-list";
import { Input } from "@/components/ui/input";
import { MenuPicker } from "@/components/ui/menu-picker";
import { Text } from "@/components/ui/text";
import { PortionSlider } from "@/features/profile/portion-slider";
import { useResolveClassNames } from "uniwind";

export function FormScreen({
  children,
  contentContainerClassName,
  contentContainerStyle,
}: {
  children: ReactNode;
  contentContainerClassName?: string;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        // The inset padding exists so screens without a stack header keep
        // their place below the status bar (see join.tsx).
        contentContainerClassName={
          contentContainerClassName ?? "gap-6 px-5 pt-5 pb-10"
        }
        contentContainerStyle={contentContainerStyle}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Field({
  label,
  hideLabel,
  error,
  validationAttempt,
  multiline,
  style,
  ref,
  ...props
}: TextInputProps & {
  label: string;
  hideLabel?: boolean;
  /** Shown under the input, where the eye already is. */
  error?: string | null;
  validationAttempt?: number;
} & React.RefAttributes<TextInputInstance>) {
  const input = useRef<TextInputInstance>(null);
  useEffect(() => {
    if (error) input.current?.focus();
  }, [error, validationAttempt]);
  return (
    <View className="gap-2">
      {hideLabel ? (
        <Text className="sr-only">{label}</Text>
      ) : (
        <Text className="font-medium">{label}</Text>
      )}
      <Input
        ref={(node) => {
          input.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        accessibilityLabel={label}
        className={`${multiline ? "min-h-28 px-4 py-4" : "min-h-14 px-4"}${error ? " border-destructive" : ""}`}
        multiline={multiline}
        style={[multiline ? { textAlignVertical: "top" } : undefined, style]}
        {...props}
      />
      <FormError message={error} />
    </View>
  );
}
export function FormError({ message }: { message?: string | null }) {
  return message ? (
    <Text
      selectable
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      className="text-destructive"
    >
      {message}
    </Text>
  ) : null;
}
/** Label + compact select in one row; boxed on iOS, flat on Android — see
 * MealRoutineEditor's original card-in-a-card writeup for why. */
export function PickerRow({
  label,
  choices,
  selectedValue,
  onValueChange,
  grouped = false,
}: {
  label: string;
  choices: readonly string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  grouped?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const row = (
    <View
      className={
        fontScale > 1.2
          ? "min-h-14 items-start gap-2 px-4 py-3"
          : "min-h-14 flex-row items-center justify-between gap-4 px-4 py-3"
      }
    >
      <Text className="flex-1 font-medium">{label}</Text>
      <MenuPicker
        label={label}
        choices={choices}
        selectedValue={selectedValue}
        onValueChange={onValueChange}
      />
    </View>
  );
  if (Platform.OS === "android" || grouped) return row;
  return (
    <View
      className="overflow-hidden rounded-xl border border-border bg-card"
      style={{ borderCurve: "continuous" }}
    >
      {row}
    </View>
  );
}
const mealRoutineChoices = [
  "Dinner",
  "Lunch and dinner",
  "All meals",
  "It varies",
] as const;

function isMealRoutine(
  value: string,
): value is (typeof mealRoutineChoices)[number] {
  return mealRoutineChoices.includes(
    value as (typeof mealRoutineChoices)[number],
  );
}

export function MealRoutineEditor({
  value,
  onChange,
  onInputHeightChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onInputHeightChange?: (height: number) => void;
}) {
  const isVarying = value === "It varies" || !isMealRoutine(value);
  const selectedValue = isVarying ? "It varies" : value;
  const detail = value === "It varies" ? "" : value;
  const routineRef = useRef<TextInputInstance>(null);
  const focusRoutine = useRef(false);
  const [windowFocused, setWindowFocused] = useState(true);
  // Android modals temporarily take window focus. Requesting the keyboard
  // before the activity regains it focuses the field but leaves the IME hidden.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const blur = AppState.addEventListener("blur", () => {
      setWindowFocused(false);
    });
    const focus = AppState.addEventListener("focus", () => {
      setWindowFocused(true);
    });
    return () => {
      blur.remove();
      focus.remove();
    };
  }, []);
  useEffect(() => {
    if (!isVarying || !windowFocused || !focusRoutine.current) return;
    focusRoutine.current = false;
    routineRef.current?.focus();
  }, [isVarying, windowFocused]);
  useEffect(() => {
    if (!isVarying) onInputHeightChange?.(0);
  }, [isVarying, onInputHeightChange]);
  return (
    <View className="gap-3">
      <PickerRow
        label="Meals to plan"
        choices={mealRoutineChoices}
        selectedValue={selectedValue}
        onValueChange={(next) => {
          focusRoutine.current = next === "It varies" && !isVarying;
          onChange(next);
        }}
      />
      {isVarying ? (
        <Field
          ref={routineRef}
          onLayout={(event) =>
            onInputHeightChange?.(event.nativeEvent.layout.height)
          }
          label="Which meals should Magpie plan?"
          multiline
          value={detail}
          onChangeText={(next) => onChange(next || "It varies")}
          placeholder="Weekday dinners, lunches and dinners on weekends"
        />
      ) : null}
      <Text className="text-sm leading-5 text-muted-foreground">
        Use this as the usual plan. Change it for any week.
      </Text>
    </View>
  );
}
export function DietEditor({
  person,
  onChange,
  allowOtherDiet = false,
  compact = false,
  grouped = false,
  otherError,
  validationAttempt,
}: {
  person: HouseholdPerson;
  onChange: (p: HouseholdPerson) => void;
  allowOtherDiet?: boolean;
  compact?: boolean;
  grouped?: boolean;
  otherError?: string | null;
  validationAttempt?: number;
}) {
  const entries = Object.entries(dietOptions).filter(
    ([key]) =>
      (allowOtherDiet || key !== "other") &&
      (key !== "meat-heavy" || person.diet === "meat-heavy"),
  );
  const isOther = person.diet === "other";
  const otherRef = useRef<TextInputInstance>(null);
  const wasOther = useRef(isOther);
  useEffect(() => {
    if (isOther && !wasOther.current) otherRef.current?.focus();
    wasOther.current = isOther;
  }, [isOther]);
  return (
    <View className="gap-3">
      {compact ? (
        <PickerRow
          label="Food rule"
          grouped={grouped}
          choices={entries.map(
            ([key]) => dietRequests[key as keyof typeof dietOptions],
          )}
          selectedValue={dietRequests[person.diet]}
          onValueChange={(title) => {
            const key = entries.find(
              ([key]) =>
                dietRequests[key as keyof typeof dietOptions] === title,
            )?.[0] as HouseholdPerson["diet"] | undefined;
            if (!key) return;
            onChange({
              ...person,
              diet: key,
              diet_other: key === "other" ? person.diet_other : "",
            });
          }}
        />
      ) : (
        <ChoiceList
          choices={entries.map(([key]) => ({
            key,
            title: dietRequests[key as keyof typeof dietOptions],
            detail: dietDescriptions[key as keyof typeof dietOptions],
          }))}
          selectedKeys={[person.diet]}
          selection="single"
          onSelect={(key) =>
            onChange({
              ...person,
              diet: key as HouseholdPerson["diet"],
              diet_other: key === "other" ? person.diet_other : "",
            })
          }
        />
      )}
      {isOther && (
        <Field
          ref={otherRef}
          label="What should Magpie change?"
          placeholder="e.g. Halal meat only. No alcohol, including in sauces."
          error={otherError}
          validationAttempt={validationAttempt}
          value={person.diet_other}
          onChangeText={(diet_other) => onChange({ ...person, diet_other })}
          returnKeyType="done"
        />
      )}
      {compact && !isOther ? (
        <Text className="text-sm leading-5 text-muted-foreground">
          {dietDescriptions[person.diet]}
        </Text>
      ) : null}
    </View>
  );
}
export function PersonFields({
  person,
  onChange,
  autoFocusName,
  errors,
  validationAttempt,
}: {
  person: HouseholdPerson;
  onChange: (p: HouseholdPerson) => void;
  autoFocusName?: boolean;
  errors?: Record<string, string>;
  validationAttempt?: number;
}) {
  return (
    <>
      <Field
        label="Name"
        error={errors?.name && !person.name.trim() ? errors.name : null}
        validationAttempt={validationAttempt}
        value={person.name}
        onChangeText={(name) => onChange({ ...person, name })}
        autoCapitalize="words"
        autoFocus={autoFocusName}
        returnKeyType="done"
      />
      <PickerRow
        label="Age group"
        choices={ageGroups}
        selectedValue={person.age_group}
        onValueChange={(age_group) =>
          onChange({
            ...person,
            age_group: age_group as HouseholdPerson["age_group"],
          })
        }
      />
      <DietEditor
        person={person}
        onChange={onChange}
        allowOtherDiet
        compact
        otherError={
          errors?.diet_other && !person.diet_other.trim()
            ? errors.diet_other
            : null
        }
        validationAttempt={validationAttempt}
      />
      <PortionReference
        value={person.portion_reference}
        onChange={(portion_reference) =>
          onChange({ ...person, portion_reference })
        }
      />
      <AttendanceEditor
        value={person.meal_times}
        onChange={(meal_times) => onChange({ ...person, meal_times })}
      />
    </>
  );
}

function PortionReference({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const primary = useResolveClassNames("text-primary").color;
  const track = useResolveClassNames("bg-muted").backgroundColor;
  const stepsPerPortion = 1 / portionReferenceRange.step;
  const snapToStep = (next: number) =>
    Math.round(next * stepsPerPortion) / stepsPerPortion;
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-4">
        <Text className="font-medium">How much to cook</Text>
        <Text className="font-semibold tabular-nums">{value}×</Text>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="How much to cook for this person"
        accessibilityHint="1 is a regular adult helping. Magpie scales ingredients to match."
        accessibilityValue={{
          min: portionReferenceRange.min,
          max: portionReferenceRange.max,
          now: value,
          text: `${value} portions`,
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) =>
          onChange(
            Math.min(
              portionReferenceRange.max,
              Math.max(
                portionReferenceRange.min,
                snapToStep(
                  value +
                    (event.nativeEvent.actionName === "increment"
                      ? portionReferenceRange.step
                      : -portionReferenceRange.step),
                ),
              ),
            ),
          )
        }
      >
        <PortionSlider
          value={value}
          onValueChange={(next) => onChange(snapToStep(next))}
          activeColor={primary}
          inactiveColor={track}
        />
      </View>
      <Text className="text-sm text-muted-foreground">
        1× is a regular adult helping. Magpie scales ingredients to match.
      </Text>
    </View>
  );
}

function AttendanceEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const choices = [
    "All planned meals",
    "Dinner only",
    "Lunch and dinner",
    "It varies",
  ];
  const all =
    value === "All meals" ||
    value === "Always" ||
    value === "All planned meals";
  const selected = all
    ? "All planned meals"
    : choices.includes(value)
      ? value
      : "It varies";
  return (
    <View className="gap-3">
      <PickerRow
        label="Include in"
        choices={choices}
        selectedValue={selected}
        onValueChange={(next) =>
          onChange(next === "All planned meals" ? "All meals" : next)
        }
      />
      {selected === "It varies" ? (
        <Field
          label="When should Magpie include them?"
          placeholder="e.g. Weekday dinners and every other weekend"
          value={value === "It varies" ? "" : value}
          onChangeText={(text) => onChange(text || "It varies")}
        />
      ) : null}
    </View>
  );
}
