import { Host, Switch } from "@expo/ui";
import {
  cooks,
  cuisineLabel,
  cuisineOptions,
  cuisineRegions,
  stapleGroups,
} from "@magpie/profile";
import { Children, isValidElement, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type TextInputInstance,
} from "react-native";
import Animated, {
  Easing,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";
import { PrimaryAction } from "@/components/action";
import { SectionTitle } from "@/components/clay";
import { EditorSheet, type EditorSheetHandle } from "@/components/editor-sheet";
import { Text } from "@/components/ui/text";
import {
  addExtra,
  cuisineId,
  ownCuisines,
  removeExtra,
  setCooking,
  toggleKept,
  type Cupboards,
} from "@/features/profile/cuisines";
import { CupboardFields } from "@/features/profile/cupboard-fields";
import { Field } from "@/features/profile/form";
import { cn } from "@/lib/utils";

type Change = (edit: (profile: Cupboards) => Cupboards) => void;

// Like iOS inserting rows under a switch: the cupboard fades in line by line
// while everything below slides down; closing fades it fast as the rows close over it.
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const REFLOW = LinearTransition.duration(300)
  .easing(EASE_IN_OUT)
  .reduceMotion(ReduceMotion.System);
// Reduce Motion keeps the fade, but drops the slide. The cupboard staggers
// its own lines in.
const CLOSE = FadeOut.duration(150)
  .easing(EASE_OUT)
  .reduceMotion(ReduceMotion.Never);

/** Every cuisine answers here: a switch says they cook it, and its cupboard opens in place. */
export function CuisineList({
  profile,
  change,
}: {
  profile: Cupboards;
  /** Applies the edit to the latest saved cupboards and saves the result. */
  change: Change;
}) {
  return (
    // Cupboards already open when the screen appears don't fade in.
    <LayoutAnimationConfig skipEntering>
      <View className="gap-6">
        {cuisineRegions.map(({ region, cuisines }) => (
          <Section key={region} title={region}>
            {Object.keys(cuisines).map((cuisine) => (
              <CuisineRow
                key={cuisine}
                cuisine={cuisine}
                profile={profile}
                change={change}
              />
            ))}
          </Section>
        ))}
        <Section title="Your own">
          {ownCuisines(profile).map((cuisine) => (
            <CuisineRow
              key={cuisine}
              cuisine={cuisine}
              profile={profile}
              change={change}
            />
          ))}
          <AddOwn
            onAdd={(name) =>
              change((p) => setCooking(p, cuisineId(p, name), true))
            }
          />
        </Section>
      </View>
    </LayoutAnimationConfig>
  );
}

/** Rows stand on the page, like an iOS list; only ticked things get a tile. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Animated.View layout={REFLOW} className="gap-1">
      <SectionTitle>{title}</SectionTitle>
      {Children.toArray(children).map((row, index) => (
        <Animated.View
          key={isValidElement(row) ? row.key : index}
          layout={REFLOW}
        >
          {/* Like iOS: from the text's start, through the 24pt gutter to the edge. */}
          {index > 0 ? (
            <View
              className="-mr-6 bg-border"
              style={{ height: StyleSheet.hairlineWidth }}
            />
          ) : null}
          {row}
        </Animated.View>
      ))}
    </Animated.View>
  );
}

function CuisineRow({
  cuisine,
  profile,
  change,
}: {
  cuisine: string;
  profile: Cupboards;
  change: Change;
}) {
  const [extra, setExtra] = useState("");
  const seedColor = useResolveClassNames("bg-primary").backgroundColor;
  const label = cuisineLabel(cuisine);
  const on = cooks(profile, cuisine);
  // Staples are kept, never cooked: always open, nothing to switch.
  const staples = stapleGroups.includes(cuisine);

  function saveExtra() {
    if (!extra.trim()) return;
    change((p) => addExtra(p, cuisine, extra));
    setExtra("");
  }

  return (
    <View className={cn("gap-4", on && "pb-6")}>
      {staples ? (
        <Text className="min-h-14 py-4 font-rounded font-semibold">
          {label}
        </Text>
      ) : (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={`I cook ${label}`}
          accessibilityState={{ checked: on }}
          onPress={() => change((p) => setCooking(p, cuisine, !on))}
          className="min-h-14 flex-row items-center gap-4 py-2"
        >
          <Text
            className={cn(
              "flex-1 font-rounded font-semibold",
              on && "text-primary",
            )}
          >
            {label}
          </Text>
          {/* The row carries the switch's touch and its accessibility. */}
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {/* Scrolled under the status bar, SwiftUI would push the switch
                down to keep it out of the safe area. */}
            <Host matchContents ignoreSafeArea="all" seedColor={seedColor}>
              <Switch value={on} onValueChange={() => {}} />
            </Host>
          </View>
        </Pressable>
      )}
      {on ? (
        <Animated.View exiting={CLOSE}>
          <CupboardFields
            ingredients={cuisineOptions[cuisine]?.ingredients ?? []}
            keeps={profile.keeps}
            onToggle={(id) => change((p) => toggleKept(p, id))}
            extras={profile.extras[cuisine] ?? []}
            onRemoveExtra={(item) =>
              change((p) => removeExtra(p, cuisine, item))
            }
            extra={extra}
            onExtraChange={setExtra}
            onAddExtra={saveExtra}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** A sheet, so the new cuisine lands on the page with its cupboard open. */
function AddOwn({ onAdd }: { onAdd: (name: string) => void }) {
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
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setName("");
          setAttempted(false);
          setAdding(true);
        }}
        className="min-h-14 flex-row items-center gap-4 py-2 active:opacity-60"
      >
        <Text className="flex-1 font-rounded font-semibold text-primary">
          Add a cuisine
        </Text>
        <Text className="text-2xl text-primary">+</Text>
      </Pressable>
      {adding ? (
        <EditorSheet
          ref={sheet}
          autoFocusInput={input}
          title="Add a cuisine"
          onDismiss={() => setAdding(false)}
        >
          <Field
            ref={input}
            label="What do you cook?"
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="words"
            error={attempted && !name.trim() ? "Enter a few words." : null}
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <PrimaryAction label="Add" onPress={add} />
        </EditorSheet>
      ) : null}
    </>
  );
}
