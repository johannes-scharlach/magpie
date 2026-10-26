import * as Haptics from "expo-haptics";
import { useState, useRef } from "react";
import {
  Pressable,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type TextInputInstance,
} from "react-native";
import {
  selectionOptions,
  goalOptions,
  goalDescriptions,
  legacyPantryOptions,
  legacyFreshOptions,
  type Selection,
  type SelectionField,
  type Goal,
} from "@magpie/profile";
import { PrimaryAction } from "@/components/action";
import { AddRow } from "@/components/add-row";
import { ChoiceList } from "@/components/choice-list";
import { clayTile, clayTilts, PressableScale } from "@/components/clay";
import { EditorSheet, type EditorSheetHandle } from "@/components/editor-sheet";
import { Text } from "@/components/ui/text";
import { Artwork, type ArtworkId } from "@/features/onboarding/artwork";
import { Field } from "@/features/profile/form";
import { cn } from "@/lib/utils";

export function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
    >
      <View
        className={cn(
          "min-h-12 justify-center rounded-full px-4 py-2",
          selected ? "bg-accent" : "bg-card",
        )}
      >
        <Text className={cn("shrink font-medium", selected && "text-primary")}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

export function ArtTile({
  art,
  title,
  width,
  tilt = 0,
  selected,
  onPress,
}: {
  art: ArtworkId;
  title: string;
  width: number;
  tilt?: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected }}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={{ width }}
      className="pt-16"
    >
      {/* Selecting puts the thing on a clay tile; unselected things stand on
          the page. The tile stays straight in the grid (tilted neighbours read
          as broken layout), only the art sits at a hand-placed angle. */}
      {/* Always a background: Android drops the radius from one added later. */}
      <View
        className={cn("px-2 pb-3", selected ? "bg-accent" : "bg-background")}
        style={clayTile}
      >
        <View
          pointerEvents="none"
          className="-mt-12 self-center"
          style={{
            width: Math.min(112, width - 12),
            transform: [{ rotate: `${tilt}deg` }],
          }}
        >
          <Artwork id={art} />
        </View>
        <View className="min-h-11 justify-center px-0.5 pt-1">
          <Text
            className={cn(
              "text-center font-rounded text-sm font-semibold",
              selected && "text-primary",
            )}
          >
            {title}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

/** Three columns of art tiles at regular text sizes; fewer as text grows. */
export function useTileLayout(dense: boolean) {
  const { width, fontScale } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState<number | null>(null);
  const availableWidth = gridWidth ?? width - 48;
  const columns =
    fontScale > 1.5
      ? 1
      : dense && availableWidth >= 322 && fontScale <= 1.1
        ? 3
        : 2;
  return {
    columns,
    // Leave fractional slack rather than letting rounding wrap the last tile.
    tileWidth: Math.floor(
      (availableWidth - TILE_GAP * (columns - 1)) / columns,
    ),
    onLayout: (event: LayoutChangeEvent) =>
      setGridWidth(event.nativeEvent.layout.width),
  };
}
export const TILE_GAP = 10;

export function ChoiceTiles({
  field,
  value,
  onChange,
}: {
  field: SelectionField;
  value: Selection;
  onChange: (value: Selection) => void;
}) {
  const { tileWidth, onLayout } = useTileLayout(
    field === "pantry" || field === "fresh_ingredients",
  );
  const [showPrevious, setShowPrevious] = useState(false);
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const [attempted, setAttempted] = useState(false);
  const input = useRef<TextInputInstance>(null);
  const sheet = useRef<EditorSheetHandle>(null);

  function add() {
    if (!custom.trim()) {
      setAttempted(true);
      input.current?.focus();
      return;
    }
    if (
      !value.other.some(
        (item) => item.toLowerCase() === custom.trim().toLowerCase(),
      )
    ) {
      onChange({ ...value, other: [...value.other, custom.trim()] });
    }
    sheet.current?.dismiss();
  }

  // Goals are intentions, not tangible objects: render as a clear multi-select list.
  if (field === "goals") {
    const presetChoices = Object.entries(goalOptions).map(([key, title]) => ({
      key,
      title,
      detail: goalDescriptions[key as Goal],
    }));
    const customChoices = value.other.map((title, index) => ({
      key: `other:${index}`,
      title,
    }));
    const choices = [...presetChoices, ...customChoices];
    const selectedKeys = [
      ...presetChoices.map((c) => c.key).filter((key) => value[key] === true),
      ...customChoices.map((c) => c.key),
    ];

    return (
      <View className="gap-4">
        <ChoiceList
          choices={choices}
          selectedKeys={selectedKeys}
          selection="multiple"
          onSelect={(key) => {
            void Haptics.selectionAsync().catch(() => {});
            if (key.startsWith("other:")) {
              const target = Number(key.slice("other:".length));
              onChange({
                ...value,
                other: value.other.filter((_, i) => i !== target),
              });
              return;
            }
            onChange({ ...value, [key]: !value[key] });
          }}
        >
          <AddRow
            label="Add a rule"
            bordered={false}
            onPress={() => {
              setCustom("");
              setAttempted(false);
              setAdding(true);
            }}
          />
        </ChoiceList>
        {adding ? (
          <EditorSheet
            ref={sheet}
            autoFocusInput={input}
            title="Add a rule"
            onDismiss={() => setAdding(false)}
          >
            <Field
              ref={input}
              label="What should Magpie do?"
              value={custom}
              onChangeText={setCustom}
              autoFocus
              error={attempted && !custom.trim() ? "Enter a few words." : null}
              returnKeyType="done"
              onSubmitEditing={add}
            />
            <PrimaryAction label="Add" onPress={add} />
          </EditorSheet>
        ) : null}
      </View>
    );
  }

  const gap = TILE_GAP;
  const options = Object.entries(selectionOptions[field]);
  const visible = options;
  const legacy: Record<string, string> =
    field === "pantry"
      ? legacyPantryOptions
      : field === "fresh_ingredients"
        ? legacyFreshOptions
        : {};
  const oldSelections = Object.entries(legacy).filter(
    ([key]) => !(key in selectionOptions[field]) && value[key] === true,
  );
  const prefix =
    field === "kitchen_equipment"
      ? "equipment"
      : field === "fresh_ingredients"
        ? "fresh"
        : "pantry";

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap" style={{ gap }} onLayout={onLayout}>
        {visible.map(([key, title], index) => (
          <ArtTile
            key={key}
            art={`${prefix}-${key}` as ArtworkId}
            title={title}
            width={tileWidth}
            tilt={clayTilts[index % clayTilts.length]}
            selected={value[key] === true}
            onPress={() => onChange({ ...value, [key]: value[key] !== true })}
          />
        ))}
      </View>
      {oldSelections.length ? (
        <View className="gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showPrevious }}
            className="min-h-11 justify-center"
            onPress={() => setShowPrevious(!showPrevious)}
          >
            <Text className="text-sm text-muted-foreground">
              Earlier selections · {oldSelections.length}
            </Text>
          </Pressable>
          {showPrevious ? (
            <View className="flex-row flex-wrap items-start gap-2">
              {oldSelections.map(([key, label]) => (
                <ChoiceChip
                  key={key}
                  label={label}
                  selected
                  onPress={() => onChange({ ...value, [key]: false })}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <View className="flex-row flex-wrap items-start gap-2">
        {value.other.map((label, index) => (
          <ChoiceChip
            key={`${index}:${label}`}
            label={label}
            selected
            onPress={() =>
              onChange({
                ...value,
                other: value.other.filter((_, i) => i !== index),
              })
            }
          />
        ))}
        <Pressable
          accessibilityRole="button"
          className="min-h-11 justify-center rounded-full border border-border bg-card px-4 py-2"
          onPress={() => {
            setCustom("");
            setAttempted(false);
            setAdding(true);
          }}
        >
          <Text className="font-medium text-primary">+ Add something</Text>
        </Pressable>
      </View>
      {adding ? (
        <EditorSheet
          ref={sheet}
          autoFocusInput={input}
          title={
            field === "kitchen_equipment"
              ? "Add equipment"
              : "Add an ingredient"
          }
          onDismiss={() => setAdding(false)}
        >
          <Field
            ref={input}
            label="Name"
            value={custom}
            onChangeText={setCustom}
            autoFocus
            error={attempted && !custom.trim() ? "Enter a few words." : null}
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <PrimaryAction label="Add" onPress={add} />
        </EditorSheet>
      ) : null}
    </View>
  );
}
