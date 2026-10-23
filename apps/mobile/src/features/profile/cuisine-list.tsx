import { Host, Switch } from "@expo/ui";
import {
  cooks,
  cuisineLabel,
  cuisineOptions,
  cuisineRegions,
  stapleGroups,
} from "@magpie/profile";
import { Children, isValidElement, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";
import { SectionTitle } from "@/components/clay";
import { Input } from "@/components/ui/input";
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
        <Animated.View key={isValidElement(row) ? row.key : index} layout={REFLOW}>
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
        <Text className="min-h-14 py-4 font-rounded font-semibold">{label}</Text>
      ) : (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={`I cook ${label}`}
          accessibilityState={{ checked: on }}
          onPress={() => change((p) => setCooking(p, cuisine, !on))}
          className="min-h-14 flex-row items-center gap-4 py-2"
        >
          <Text
            className={cn("flex-1 font-rounded font-semibold", on && "text-primary")}
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
            onRemoveExtra={(item) => change((p) => removeExtra(p, cuisine, item))}
            extra={extra}
            onExtraChange={setExtra}
            onAddExtra={saveExtra}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function AddOwn({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <View className="py-3">
      <Input
        accessibilityLabel="Add another cuisine"
        placeholder="Add another cuisine"
        className="h-12 min-h-0 rounded-2xl border-0 bg-muted px-3.5 py-1"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={() => {
          if (!name.trim()) return;
          onAdd(name);
          setName("");
        }}
      />
    </View>
  );
}
