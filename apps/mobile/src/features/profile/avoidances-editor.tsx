import {
  type HouseholdPerson,
  type IngredientAvoidance,
} from "@magpie/profile";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";
import { PrimaryAction } from "@/components/action";
import { AddRow } from "@/components/add-row";
import { EditorSheet, type EditorSheetHandle } from "@/components/editor-sheet";
import { Text } from "@/components/ui/text";
import { avoidanceSummary } from "@/features/profile/avoidance-entry";
import { Field, FormError } from "@/features/profile/form";

export function AvoidancesEditor({
  value,
  people,
  onAdd,
  onEdit,
  notes,
  onSaveNotes,
}: {
  value: IngredientAvoidance[];
  people: HouseholdPerson[];
  onAdd: (ingredient?: string, kind?: IngredientAvoidance["kind"]) => void;
  onEdit: (index: number) => void;
  notes: string;
  onSaveNotes: (notes: string) => void | Promise<void>;
}) {
  const muted = useResolveClassNames("text-muted-foreground").color;
  const [editingNotes, setEditingNotes] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheet = useRef<EditorSheetHandle>(null);
  async function saveNotes() {
    if (busy) return;
    setBusy(true);
    try {
      await onSaveNotes(text);
      sheet.current?.dismiss();
    } catch {
      setError("Could not save your notes. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="gap-8">
      {[false, true].map((dislikes) => {
        const entries = value
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => (item.kind === "dislike") === dislikes);
        const suggestions = (
          dislikes
            ? ["Coriander", "Mushrooms", "Olives"]
            : ["Soy", "Peanuts", "Milk", "Gluten"]
        ).filter(
          (name) =>
            !value.some(
              (item) => item.ingredient.toLowerCase() === name.toLowerCase(),
            ),
        );
        return (
          <View key={String(dislikes)} className="gap-3">
            <Text
              accessibilityRole="header"
              className="font-rounded text-xl font-bold"
            >
              {dislikes ? "Things you don’t enjoy" : "Allergies & must-avoids"}
            </Text>
            <View
              className="overflow-hidden rounded-xl border border-border bg-card"
              style={{ borderCurve: "continuous" }}
            >
              {entries.map(({ item, index }) => {
                const summary = avoidanceSummary(item, people);
                return (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${item.ingredient}. ${summary}`}
                    className="min-h-16 flex-row items-center gap-3 border-b border-border px-4 py-3 active:bg-accent"
                    onPress={() => onEdit(index)}
                  >
                    <View className="flex-1 gap-1">
                      <Text className="font-medium">{item.ingredient}</Text>
                      <Text className="text-sm leading-5 text-muted-foreground">
                        {summary}
                      </Text>
                    </View>
                    <SymbolView
                      name={{ ios: "chevron.right", android: "chevron_right" }}
                      size={16}
                      tintColor={muted}
                    />
                  </Pressable>
                );
              })}
              <AddRow
                bordered={false}
                label={
                  dislikes ? "Add a dislike" : "Add an allergy or restriction"
                }
                onPress={() =>
                  onAdd(undefined, dislikes ? "dislike" : undefined)
                }
              />
            </View>
            {suggestions.length ? (
              <View className="flex-row flex-wrap gap-2">
                {suggestions.map((name) => (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${name}`}
                    onPress={() =>
                      onAdd(name, dislikes ? "dislike" : undefined)
                    }
                    className="min-h-11 justify-center rounded-full border border-border px-3.5 py-2"
                  >
                    <Text className="text-sm text-muted-foreground">
                      + {name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
      {notes.trim() ? (
        <Pressable
          accessibilityRole="button"
          className="gap-1 py-2"
          onPress={() => {
            setText(notes);
            setError(null);
            setEditingNotes(true);
          }}
        >
          <Text className="font-medium text-primary">Earlier food notes</Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            {notes}
          </Text>
        </Pressable>
      ) : null}
      {editingNotes ? (
        <EditorSheet
          ref={sheet}
          title="Food notes"
          onDismiss={() => setEditingNotes(false)}
        >
          <Field
            label="What should Magpie follow?"
            multiline
            value={text}
            onChangeText={setText}
          />
          <FormError message={error} />
          <PrimaryAction
            label={busy ? "Saving…" : "Save"}
            disabled={busy}
            onPress={() => void saveNotes()}
          />
        </EditorSheet>
      ) : null}
    </View>
  );
}
