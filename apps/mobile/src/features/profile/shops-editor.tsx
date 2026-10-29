import { profileShops, shopRuleSummaries } from "@magpie/profile";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";
import { Text } from "@/components/ui/text";
import { PrimaryAction } from "@/components/action";
import { EditorSheet, type EditorSheetHandle } from "@/components/editor-sheet";
import { Field, FormError } from "@/features/profile/form";
import type { ShopsProfile } from "@/features/profile/shop-entry";

const shopSuggestions = [
  "Butcher",
  "Asian supermarket",
  "Weekly market",
] as const;

export function ShopsEditor({
  profile,
  onSaveNotes,
  onEdit,
  onAdd,
  validationAttempt = 0,
}: {
  profile: ShopsProfile;
  onSaveNotes: (notes: string) => void | Promise<void>;
  onEdit: (index: number) => void;
  onAdd: (name?: string) => void;
  validationAttempt?: number;
}) {
  const shops = profileShops(profile);
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const notesSheet = useRef<EditorSheetHandle>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  async function saveNotes() {
    if (notes === null || savingNotes) return;
    setSavingNotes(true);
    setNotesError(null);
    try {
      await onSaveNotes(notes);
      notesSheet.current?.dismiss();
    } catch {
      setNotesError("Could not save your notes. Try again.");
    } finally {
      setSavingNotes(false);
    }
  }
  const remainingSuggestions = shopSuggestions.filter(
    (name) =>
      !shops.some((shop) => shop.name.toLowerCase() === name.toLowerCase()),
  );
  return (
    <View className="gap-7">
      {shops.length ? (
        <View
          className="overflow-hidden rounded-xl border border-border bg-card"
          style={{ borderCurve: "continuous" }}
        >
          {shops.map((shop, index) => (
            <View key={index}>
              {index > 0 ? (
                <View
                  className={
                    Platform.OS === "ios"
                      ? "ml-4 border-t border-border"
                      : "border-t border-border"
                  }
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${shop.name}, ${shop.rule ? shopRuleSummaries[shop.rule] : "Choose a rule"}`}
                className="min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
                onPress={() => onEdit(index)}
              >
                <View className="flex-1 gap-1">
                  <Text className="text-[17px] font-medium">{shop.name}</Text>
                  <Text className="text-sm leading-5 text-muted-foreground">
                    {shop.rule ? shopRuleSummaries[shop.rule] : "Choose a rule"}
                  </Text>
                </View>
                <SymbolView
                  name={{ ios: "chevron.right", android: "chevron_right" }}
                  size={16}
                  tintColor={mutedColor}
                />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {validationAttempt > 0 && shops.some((shop) => !shop.rule) ? (
        <FormError message="Choose a rule for each shop. Tap a shop to change it." />
      ) : null}
      <View className="gap-4">
        <Pressable
          accessibilityRole="button"
          className="min-h-11 self-start justify-center"
          onPress={() => onAdd()}
        >
          <Text className="font-medium text-primary">
            + {shops.length ? "Add another shop" : "Add a shop"}
          </Text>
        </Pressable>
        {shops.some((shop) => shop.rule) && remainingSuggestions.length ? (
          <View className="flex-row flex-wrap gap-2">
            {remainingSuggestions.map((name) => (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel={`Add ${name}`}
                className="min-h-11 justify-center rounded-full border border-border px-3 py-2 active:bg-accent"
                onPress={() => onAdd(name)}
              >
                <Text className="text-sm text-primary">+ {name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      {profile.other_shops ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit shopping notes"
          className="gap-2 py-3"
          onPress={() => {
            setNotesError(null);
            setNotes(profile.other_shops);
          }}
        >
          <Text className="font-medium">Shopping notes</Text>
          <Text
            className="text-sm leading-5 text-muted-foreground"
            numberOfLines={3}
          >
            {profile.other_shops}
          </Text>
        </Pressable>
      ) : null}
      {notes !== null ? (
        <EditorSheet
          ref={notesSheet}
          title="Shopping notes"
          onDismiss={() => setNotes(null)}
        >
          <Field
            label="Notes"
            multiline
            value={notes}
            onChangeText={setNotes}
          />
          <FormError message={notesError} />
          <PrimaryAction
            label={savingNotes ? "Saving…" : "Save"}
            disabled={savingNotes}
            onPress={() => void saveNotes()}
          />
        </EditorSheet>
      ) : null}
    </View>
  );
}
