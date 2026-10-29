import { Host, Switch } from "@expo/ui";
import { cuisineLabel, cuisineRegions } from "@magpie/profile";
import { useRef, useState } from "react";
import { Pressable, View, type TextInputInstance } from "react-native";
import { useResolveClassNames } from "uniwind";
import { PrimaryAction } from "@/components/action";
import { AddRow } from "@/components/add-row";
import { SectionTitle } from "@/components/clay";
import { EditorSheet, type EditorSheetHandle } from "@/components/editor-sheet";
import { Text } from "@/components/ui/text";
import { CupboardFields } from "@/features/profile/cupboard-fields";
import {
  cuisineId,
  ownCuisines,
  setCooking,
  type CupboardChange,
  type Cupboards,
} from "@/features/profile/cuisines";
import { Field } from "@/features/profile/form";
import { cn } from "@/lib/utils";

/** Choosing a cuisine and showing what you keep for it is one continuous task. */
export function CuisineList({
  profile,
  change,
}: {
  profile: Cupboards;
  change: CupboardChange;
}) {
  return (
    <View className="gap-6">
      {cuisineRegions
        .filter(({ region }) => region !== "Staples")
        .map(({ region, cuisines }) => (
          <View key={region} className="gap-1">
            <SectionTitle>{region}</SectionTitle>
            {Object.keys(cuisines).map((cuisine) => (
              <CuisineRow
                key={cuisine}
                cuisine={cuisine}
                profile={profile}
                change={change}
              />
            ))}
          </View>
        ))}
      <View className="gap-1">
        <SectionTitle>Your own cooking</SectionTitle>
        {ownCuisines(profile).map((cuisine) => (
          <CuisineRow
            key={cuisine}
            cuisine={cuisine}
            profile={profile}
            change={change}
          />
        ))}
        <AddCuisine
          onAdd={(name) =>
            change((p) => setCooking(p, cuisineId(p, name), true))
          }
        />
      </View>
    </View>
  );
}

function CuisineRow({
  cuisine,
  profile,
  change,
}: {
  cuisine: string;
  profile: Cupboards;
  change: CupboardChange;
}) {
  const label = cuisineLabel(cuisine);
  const selected = profile.cuisines.includes(cuisine);
  const seed = useResolveClassNames("bg-primary").backgroundColor;
  return (
    <View className={cn("border-b border-border", selected && "pb-6")}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={`I cook ${label}`}
        accessibilityState={{ checked: selected }}
        onPress={() =>
          change((p) => setCooking(p, cuisine, !p.cuisines.includes(cuisine)))
        }
        className="min-h-14 flex-row items-center gap-4 py-2"
      >
        <Text
          className={cn(
            "flex-1 font-rounded font-semibold",
            selected && "text-primary",
          )}
        >
          {label}
        </Text>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Host matchContents ignoreSafeArea="all" seedColor={seed}>
            <Switch value={selected} onValueChange={() => {}} />
          </Host>
        </View>
      </Pressable>
      {selected ? (
        <CupboardFields group={cuisine} profile={profile} change={change} />
      ) : null}
    </View>
  );
}

function AddCuisine({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [attempted, setAttempted] = useState(false);
  const input = useRef<TextInputInstance>(null);
  const sheet = useRef<EditorSheetHandle>(null);
  function add() {
    if (!name.trim()) {
      setAttempted(true);
      input.current?.focus();
      return;
    }
    onAdd(name);
    sheet.current?.dismiss();
  }
  return (
    <>
      <AddRow
        bordered={false}
        label="Add another cuisine"
        onPress={() => {
          setName("");
          setAttempted(false);
          setAdding(true);
        }}
      />
      {adding ? (
        <EditorSheet
          ref={sheet}
          autoFocusInput={input}
          title="Add a cuisine or cooking style"
          onDismiss={() => setAdding(false)}
        >
          <Field
            ref={input}
            label="What do you cook?"
            placeholder="A cuisine, region or your own way of cooking"
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="words"
            error={
              attempted && !name.trim()
                ? "Enter a cuisine or cooking style."
                : null
            }
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <PrimaryAction label="Add" onPress={add} />
        </EditorSheet>
      ) : null}
    </>
  );
}
