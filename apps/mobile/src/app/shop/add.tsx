import { useQuery } from "@powersync/react";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import {
  useHeaderHeight,
  usePreventRemove,
} from "expo-router/react-navigation";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
  type TextInputInstance,
} from "react-native";
import { defineMessages, useIntl } from "react-intl";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResolveClassNames } from "uniwind";

import { PressableScale } from "@/components/clay";
import { Text } from "@/components/ui/text";
import { addItem, itemNameKey, setItemSpec } from "@/db/items";
import type { ListItem } from "@/db/schema";
import { ingredientPickerSections } from "@/features/chat/ingredient-picker";
import { useIngredientArt } from "@/features/ingredients/ingredient-art";
import { formatPickerIngredient } from "@/features/ingredients/ingredient-labels";
import { useHousehold } from "@/features/profile/use-household";
import { categorizeItemAsync } from "@/features/shop/categorize";
import { shoppingItemMove } from "@/features/shop/item-motion";
import { shopMessages } from "@/features/shop/messages";
import { capitalize } from "@/features/shop/text";
import { posthog } from "@/lib/posthog";

const fieldMessages = defineMessages({
  nextItem: {
    defaultMessage: "Next item",
    description:
      "Placeholder in the entry field after at least one item was added. Keeps the cook typing the next one.",
  },
  firstItem: {
    defaultMessage: "Add an item",
    description:
      "Placeholder in the entry field where the cook types what to buy.",
  },
});

const suggestionMessages = defineMessages<{ add: { name: string } }>(
  {
    add: {
      defaultMessage: "Add {name}",
      description:
        "Accessibility label for a suggested item that can be added to the shopping list. {name} is the item's name.",
    },
  },
  { typed: true },
);

type Added = {
  id: string;
  name: string;
  spec: string | null;
};

/** Continuous entry: type, Return, type the next one. Everything sits
 *  together above the field. Items added this session stay at the top,
 *  with their details editable in place and saved on blur. */
export default function AddItemSheet() {
  const intl = useIntl();
  const { listId } = useLocalSearchParams<{ listId?: string }>();
  const { household } = useHousehold(listId ?? null);
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  // Raw keyboard height, not KeyboardAvoidingView: inside a pageSheet it
  // measures its own frame wrong and leaves the field under the keyboard.
  // The sheet ends at the screen's bottom edge, so the full height is the
  // overlap; the home-indicator inset only applies while it's closed.
  const keyboard = useReanimatedKeyboardAnimation();
  const bottomInset = Math.max(insets.bottom, 12);
  const avoidKeyboard = useAnimatedStyle(() => ({
    paddingBottom:
      -keyboard.height.value +
      interpolate(keyboard.progress.value, [0, 1], [bottomInset, 8]),
  }));
  const inputRef = useRef<TextInputInstance>(null);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState("");
  const [settleItems, setSettleItems] = useState(false);
  const [added, setAdded] = useState<Added[]>([]);
  const [details, setDetails] = useState<Record<string, string>>({});
  const primaryColor = useResolveClassNames("text-primary").color;
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const needle = itemNameKey(draft);

  const { data: matches } = useQuery<ListItem>(
    `SELECT * FROM list_items
      WHERE list_id = ? AND planned_meal_id IS NULL AND status = 'purchased'
        AND ((? = '' AND purchase_count > 0)
             OR (? != '' AND instr(name_key, ?) > 0))
      ORDER BY CASE WHEN name_key = ? THEN 0 ELSE 1 END,
               purchase_count DESC, updated_at DESC
      LIMIT 12`,
    [listId ?? "", needle, needle, needle, needle],
  );
  const { data: activeItems } = useQuery<Pick<ListItem, "id" | "name_key">>(
    `SELECT id, name_key FROM list_items
      WHERE list_id = ? AND planned_meal_id IS NULL AND status = 'active'`,
    [listId ?? ""],
  );
  const seen = new Set([
    ...activeItems.map(({ name_key }) => name_key),
    ...added.map(({ name }) => itemNameKey(name)),
  ]);
  const suggestions = [
    ...matches.flatMap((item) =>
      item.name
        ? [
            {
              name: item.name,
              artLabel: item.name,
            },
          ]
        : [],
    ),
    ...ingredientPickerSections({
      profile: household?.profile,
      query: draft,
      displayLabel: (name) => formatPickerIngredient(intl, name),
    }).flatMap(({ tiles }) =>
      tiles.map(({ label }) => ({
        name: formatPickerIngredient(intl, label),
        artLabel: label,
      })),
    ),
  ]
    .filter(({ name }) => {
      const key = itemNameKey(name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 18)
    .sort((a, b) => a.name.localeCompare(b.name, intl.locale));
  const artFor = useIngredientArt([
    ...added.map(({ name }) => name),
    ...suggestions.map(({ artLabel }) => artLabel),
  ]);

  const unsaved = added.filter(
    (item) =>
      (details[item.id] ?? item.spec ?? "").trim() !== (item.spec ?? ""),
  );

  usePreventRemove(unsaved.length > 0, ({ data }) => {
    void saveDetails()
      .then(() => navigation.dispatch(data.action))
      .catch(() =>
        Alert.alert(
          intl.formatMessage(shopMessages.saveDetails),
          intl.formatMessage(shopMessages.detailsKept),
        ),
      );
  });

  async function saveDetails() {
    for (const item of unsaved) {
      const spec = details[item.id] ?? "";
      await setItemSpec(item.id, spec);
      setAdded((current) =>
        current.map((a) =>
          a.id === item.id ? { ...a, spec: spec.trim() || null } : a,
        ),
      );
    }
  }

  async function add(name: string) {
    if (!listId || !name.trim() || busy.current) return;
    const active = activeItems.find(
      (item) => item.name_key === itemNameKey(name),
    );
    if (active) {
      await edit(active.id);
      return;
    }
    busy.current = true;
    setSaving(true);
    const submittedDraft = draft;
    const wasPurchased = matches.some(
      (item) => item.name_key === itemNameKey(name),
    );
    try {
      await saveDetails();
      const item = await addItem(listId, name);
      if (!item) return;
      if (!item.categoryId) {
        void categorizeItemAsync(item.id, item.name);
      }
      // Store in entry order; render newest first.
      setSettleItems(true);
      setAdded((current) => [
        ...current.filter((a) => a.id !== item.id),
        { id: item.id, name: item.name, spec: item.spec },
      ]);
      setDetails((current) => ({ ...current, [item.id]: item.spec ?? "" }));
      posthog?.capture("shopping_item_added", {
        reactivated_existing_item: wasPurchased,
        needs_category: !item.categoryId,
      });
      setDraft((current) => (current === submittedDraft ? "" : current));
      inputRef.current?.focus();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert(
        intl.formatMessage(shopMessages.addItem),
        intl.formatMessage(shopMessages.entryKept),
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function edit(id: string) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await saveDetails();
      setDraft("");
      router.push({ pathname: "/shop/item", params: { itemId: id } });
    } catch {
      Alert.alert(
        intl.formatMessage(shopMessages.saveDetails),
        intl.formatMessage(shopMessages.detailsKept),
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function finish() {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      await saveDetails();
      router.back();
    } catch {
      Alert.alert(
        intl.formatMessage(shopMessages.saveDetails),
        intl.formatMessage(shopMessages.tryAgain),
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Animated.View style={[{ flex: 1 }, avoidKeyboard]}>
      <Stack.Screen
        options={{
          // One surface: the bar floats over the sheet, only Done is glass.
          headerTransparent: true,
          headerRight: () => (
            <Pressable
              onPress={() => void finish()}
              disabled={saving}
              hitSlop={12}
              accessibilityRole="button"
              className="px-2 py-1"
            >
              <Text className="text-base font-semibold text-primary">
                {intl.formatMessage({
                  defaultMessage: "Done",
                  description:
                    "Action that closes the shopping item entry sheet, keeping what was added.",
                })}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        // Reserve room below the sheet's floating navigation bar.
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="pb-3"
        contentContainerStyle={{ paddingTop: headerHeight }}
      >
        <View className="px-4 pt-3">
          {[
            ...[...added].reverse().map((item) => (
              <Animated.View
                key={itemNameKey(item.name)}
                layout={settleItems ? shoppingItemMove : undefined}
                className="min-h-12 flex-row items-start gap-3 border-b border-border/60 px-2 py-2.5"
              >
                <ItemArt asset={artFor(item.name)} />
                <View className="flex-1">
                  <View className="flex-row items-baseline gap-3">
                    <Text className="flex-1 text-[17px]">
                      {capitalize(item.name)}
                    </Text>
                  </View>
                  <TextInput
                    value={details[item.id] ?? ""}
                    onChangeText={(text) =>
                      setDetails((current) => ({
                        ...current,
                        [item.id]: text,
                      }))
                    }
                    onEndEditing={() =>
                      void saveDetails().catch(() =>
                        Alert.alert(
                          intl.formatMessage(shopMessages.saveDetails),
                          intl.formatMessage(shopMessages.tryAgain),
                        ),
                      )
                    }
                    editable={!saving}
                    placeholder={intl.formatMessage({
                      defaultMessage: "Add details",
                      description:
                        "Placeholder in the note field of an item just added to the list. The note is free text, such as a size or brand.",
                    })}
                    placeholderTextColor={mutedColor}
                    accessibilityLabel={intl.formatMessage(
                      {
                        defaultMessage: "Details for {name}",
                        description:
                          "Accessibility label for the note field of an added shopping item. {name} is the item's name.",
                      },
                      { name: item.name },
                    )}
                    returnKeyType="done"
                    onSubmitEditing={() => inputRef.current?.focus()}
                    submitBehavior="submit"
                    selectionColor={primaryColor}
                    className="py-0.5 text-[15px] text-muted-foreground placeholder:text-muted-foreground/60"
                  />
                </View>
              </Animated.View>
            )),
            ...suggestions.map(({ name, artLabel }) => (
              <Animated.View
                key={itemNameKey(name)}
                layout={settleItems ? shoppingItemMove : undefined}
              >
                <PressableScale
                  className="min-h-12 justify-center border-b border-border/60"
                  disabled={saving || !listId}
                  onPress={() => void add(name)}
                  accessibilityRole="button"
                  accessibilityLabel={intl.formatMessage(
                    suggestionMessages.add,
                    {
                      name,
                    },
                  )}
                >
                  <View className="flex-row items-center gap-3 px-2 py-1">
                    <Text className="flex-1 font-rounded text-base font-bold">
                      {capitalize(name)}
                    </Text>
                    {artFor(artLabel) !== undefined ? (
                      <ItemArt asset={artFor(artLabel)} />
                    ) : null}
                    <SymbolView
                      name={{ ios: "plus", android: "add" }}
                      tintColor={mutedColor}
                      size={16}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                  </View>
                </PressableScale>
              </Animated.View>
            )),
          ]}
        </View>
      </ScrollView>
      <View className="px-4 pt-2">
        <View className="h-11 flex-row items-center rounded-full bg-muted ps-4 pe-1.5">
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={(text) => {
              setSettleItems(false);
              setDraft(text);
            }}
            editable={!!listId}
            placeholder={intl.formatMessage(
              added.length ? fieldMessages.nextItem : fieldMessages.firstItem,
            )}
            placeholderTextColor={mutedColor}
            accessibilityLabel={intl.formatMessage({
              defaultMessage: "Add an item",
              description:
                "Accessibility label for the field where the cook types what to buy.",
            })}
            autoFocus
            autoCapitalize="sentences"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => void add(draft)}
            selectionColor={primaryColor}
            className="h-11 flex-1 pr-2 text-[17px] text-foreground placeholder:text-muted-foreground/70"
          />
          <Pressable
            onPress={() => void add(draft)}
            disabled={saving || !draft.trim()}
            accessibilityRole="button"
            accessibilityLabel={intl.formatMessage({
              defaultMessage: "Add",
              description:
                "Accessibility label for the button that adds the typed item to the shopping list.",
            })}
            hitSlop={8}
          >
            <SymbolView
              name={{ ios: "plus.circle.fill", android: "add_circle" }}
              tintColor={draft.trim() ? primaryColor : mutedColor}
              size={32}
            />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function ItemArt({
  asset,
}: {
  asset: ReturnType<ReturnType<typeof useIngredientArt>>;
}) {
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  return (
    <View
      className="h-10 w-12 items-center justify-center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {asset !== undefined ? (
        <Image
          source={asset}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
        />
      ) : (
        <SymbolView
          name={{ ios: "bag", android: "shopping_bag" }}
          tintColor={mutedColor}
          size={22}
        />
      )}
    </View>
  );
}
