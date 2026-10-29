import {
  cuisineLabel,
  habitDaysLabel,
  habitMeals,
  newDishesOptions,
  weekdayLabels,
  weekdays,
  type DayHabit,
  type HabitMeal,
  type NewDishes,
  type Weekday,
} from "@magpie/profile";
import { useQuery } from "@powersync/react";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Action, PrimaryAction } from "@/components/action";
import { AddRow } from "@/components/add-row";
import { ChoiceList } from "@/components/choice-list";
import { EditorSheet, type EditorSheetHandle } from "@/components/editor-sheet";
import { Text } from "@/components/ui/text";
import { ChoiceChip } from "@/features/profile/choice-tiles";
import {
  habitChoices,
  habitConsequence,
  type HabitChoice,
} from "@/features/profile/habits";

const mealLabels: Record<HabitMeal, string> = {
  lunch: "Lunch",
  dinner: "Dinner",
  treat: "Treat",
};
const dayShortcuts: { label: string; days: Weekday[] }[] = [
  { label: "Every day", days: [...weekdays] },
  { label: "Weekdays", days: ["mon", "tue", "wed", "thu", "fri"] },
  { label: "Weekend", days: ["sat", "sun"] },
];
/** Enough to choose from without the sheet outgrowing the screen. */
const MAX_CHOICES = 18;

export const newDishesConsequences: Record<NewDishes, string> = {
  rarely: "Magpie plans mostly dishes you’ve had before.",
  sometimes:
    "Magpie plans mostly dishes you know, and about one new dish a week.",
  often: "Magpie plans mostly dishes you haven’t had yet.",
};

/** The household's cuisines and tags with how many recipes have each. */
export function useHabitChoices(
  listId: string | null,
  cuisines: string[],
): HabitChoice[] {
  const { data } = useQuery<{ what: string; recipes: number }>(
    `SELECT word AS what, count(DISTINCT id) AS recipes FROM (
       SELECT id, cuisine AS word FROM recipes
         WHERE list_id = ? AND cuisine IS NOT NULL
       UNION ALL
       SELECT recipes.id, tag.value FROM recipes, json_each(recipes.tags) tag
         WHERE recipes.list_id = ?
     ) GROUP BY word`,
    [listId, listId],
  );
  return habitChoices(data, cuisines);
}

export function habitSummary(habits: DayHabit[]): string {
  return habits
    .map(
      ({ days, meal, what }) =>
        `${habitDaysLabel(days)} ${mealLabels[meal].toLowerCase()}: ${cuisineLabel(what)}`,
    )
    .join(", ");
}

/** Each habit is days, a meal and a kind of dish or cuisine. */
export function DayHabitsEditor({
  value,
  onChange,
  choices,
}: {
  value: DayHabit[];
  onChange: (habits: DayHabit[]) => void;
  choices: HabitChoice[];
}) {
  // null: closed; -1: a new habit; otherwise the index being edited.
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <>
      <View
        className="overflow-hidden rounded-xl border border-border bg-card"
        style={{ borderCurve: "continuous" }}
      >
        {value.map((habit, index) => (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityHint="Change or remove this habit"
            className="min-h-14 gap-0.5 border-b border-border px-4 py-3 active:bg-accent"
            onPress={() => setEditing(index)}
          >
            <Text className="font-medium">
              {`${habitDaysLabel(habit.days)} · ${mealLabels[habit.meal]}: ${cuisineLabel(habit.what)}`}
            </Text>
            <Text className="text-sm leading-5 text-muted-foreground">
              {habitConsequence(habit)}
            </Text>
          </Pressable>
        ))}
        <AddRow
          bordered={false}
          label="Add a habit"
          onPress={() => setEditing(-1)}
        />
      </View>
      {editing !== null ? (
        <HabitSheet
          initial={value[editing]}
          choices={choices}
          onSave={(habit) =>
            onChange(
              editing === -1
                ? [...value, habit]
                : value.map((old, index) => (index === editing ? habit : old)),
            )
          }
          onRemove={
            editing === -1
              ? undefined
              : () => onChange(value.filter((_, index) => index !== editing))
          }
          onDismiss={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function HabitSheet({
  initial,
  choices,
  onSave,
  onRemove,
  onDismiss,
}: {
  initial?: DayHabit;
  choices: HabitChoice[];
  onSave: (habit: DayHabit) => void;
  onRemove?: () => void;
  onDismiss: () => void;
}) {
  const sheet = useRef<EditorSheetHandle>(null);
  const [days, setDays] = useState<Weekday[]>(initial?.days ?? []);
  const [meal, setMeal] = useState<HabitMeal>(initial?.meal ?? "dinner");
  const [what, setWhat] = useState<string | null>(initial?.what ?? null);
  const shown = choices.slice(0, MAX_CHOICES);
  // A saved habit stays choosable even when its word fell out of the list.
  if (what && !shown.some((choice) => choice.what === what))
    shown.unshift({ what, label: cuisineLabel(what) });
  const habit = days.length && what ? { days, meal, what } : null;
  const same = (set: Weekday[]) =>
    set.length === days.length && set.every((day) => days.includes(day));
  function toggleDay(day: Weekday) {
    setDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : weekdays.filter((d) => d === day || current.includes(d)),
    );
  }
  function finish(run: () => void) {
    run();
    sheet.current?.dismiss();
  }
  return (
    <EditorSheet
      ref={sheet}
      title={initial ? "Change habit" : "Add a habit"}
      onDismiss={onDismiss}
    >
      <ChipGroup title="Days">
        {dayShortcuts.map(({ label, days: set }) => (
          <ChoiceChip
            key={label}
            label={label}
            selected={same(set)}
            onPress={() => setDays(same(set) ? [] : set)}
          />
        ))}
        {weekdays.map((day) => (
          <ChoiceChip
            key={day}
            label={weekdayLabels[day]}
            selected={days.includes(day)}
            onPress={() => toggleDay(day)}
          />
        ))}
      </ChipGroup>
      <ChipGroup title="Meal">
        {habitMeals.map((slot) => (
          <ChoiceChip
            key={slot}
            label={mealLabels[slot]}
            selected={meal === slot}
            onPress={() => setMeal(slot)}
          />
        ))}
      </ChipGroup>
      <ChipGroup title="What">
        {shown.map((choice) => (
          <ChoiceChip
            key={choice.what}
            label={
              choice.recipes
                ? `${choice.label} (${choice.recipes})`
                : choice.label
            }
            selected={what === choice.what}
            onPress={() => setWhat(choice.what)}
          />
        ))}
      </ChipGroup>
      <Text variant="muted">
        {habit
          ? `${habitConsequence(habit)} You can always ask for something else.`
          : "Choose the days and what to plan."}
      </Text>
      <PrimaryAction
        label={initial ? "Save habit" : "Add habit"}
        disabled={!habit}
        onPress={() => habit && finish(() => onSave(habit))}
      />
      {onRemove ? (
        <Action
          label="Remove habit"
          destructive
          onPress={() => finish(onRemove)}
        />
      ) : null}
    </EditorSheet>
  );
}

function ChipGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="font-semibold">{title}</Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

/** One choice of three; tapping the chosen one again leaves no rule. */
export function NewDishesEditor({
  value,
  onChange,
}: {
  value: NewDishes | null;
  onChange: (value: NewDishes | null) => void;
}) {
  return (
    <ChoiceList
      selection="single"
      choices={(Object.keys(newDishesOptions) as NewDishes[]).map((key) => ({
        key,
        title: newDishesOptions[key],
        detail: newDishesConsequences[key],
      }))}
      selectedKeys={value ? [value] : []}
      onSelect={(key) => onChange(key === value ? null : (key as NewDishes))}
    />
  );
}
