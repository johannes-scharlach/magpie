import { useQuery } from "@powersync/react";
import * as Crypto from "expo-crypto";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { SymbolView } from "expo-symbols";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import { useIntl } from "react-intl";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import {
  KeyboardAvoidingView,
  useKeyboardState,
} from "react-native-keyboard-controller";
import Animated from "react-native-reanimated";
import { useResolveClassNames } from "uniwind";

import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import type { Variant as DbVariant } from "@/db/schema";
import { MEALS_WITH_SHOPPING, type ShoppingMeal } from "@/db/shopping-meals";
import { clearPlannedMeal, setPlannedMeal } from "@/db/planned-meals";
import { dishMessage, slotEntryMessage } from "@/features/chat/compose";
import { queueMessage } from "@/features/chat/message-queue";
import {
  DayContent,
  type DisplayPlannedMeal,
  type DisplayRecipe,
  type RecentMealReference,
} from "@/features/meals/day-content";
import { DayStrip } from "@/features/meals/day-strip";
import { useEatersLabel } from "@/features/meals/eaters-label";
import { parseEaterIds, toEaters } from "@/features/meals/eaters";
import { formatMealTarget } from "@/features/meals/labels";
import {
  MealTypingLayout,
  type ChooserFrame,
} from "@/features/meals/meal-choice-entry";
import {
  dateKey,
  stripDates,
  type MealSlot,
  type MealTarget,
} from "@/features/meals/slots";
import { usePanSwipeDay } from "@/features/meals/use-pan-swipe-day";
import { recentMealReferences } from "@/features/meals/variant-meals";
import { useImportJobs } from "@/features/meals/use-import-jobs";
import { useActiveList } from "@/features/onboarding/access";
import { HouseholdAvatars } from "@/features/profile/household-avatars";
import {
  MealRecommendationError,
  prepareRecommendedMeal,
  useMealRecommendations,
} from "@/features/meals/use-meal-recommendations";
import { useToday } from "@/hooks/use-today";

function slotKey(listId: string | undefined, date: string, slot: MealSlot) {
  return `${listId ?? ""}:${date}:${slot}`;
}

export default function Meals() {
  const intl = useIntl();
  const iconColor = useResolveClassNames("text-foreground").color;
  const eatersLabel = useEatersLabel();
  const [{ dates, todayIndex }] = useState(stripDates);
  const {
    date: requestedDate,
    at,
    dinnerSuggestion,
  } = useLocalSearchParams<{
    date?: string;
    at?: string;
    dinnerSuggestion?: string;
  }>();
  const [selected, setSelected] = useState(() => {
    if (requestedDate && dates.some((d) => dateKey(d) === requestedDate)) {
      return requestedDate;
    }
    return dateKey(new Date());
  });
  // Household activity opens a day; `at` makes a repeated tap reselect it.
  const request = requestedDate ? `${requestedDate}@${at}` : null;
  const [handledRequest, setHandledRequest] = useState<string | null>(request);
  if (request !== handledRequest) {
    setHandledRequest(request);
    if (requestedDate && dates.some((d) => dateKey(d) === requestedDate)) {
      setSelected(requestedDate);
    }
  }
  const [openSlots, setOpenSlots] = useState<Set<string>>(() => new Set());
  // optimistic pending — avoids flicker through hidden state while PowerSync query catches up
  const [pending, setPending] = useState<
    Record<string, DisplayPlannedMeal | null>
  >({});
  const importJobs = useImportJobs();
  const { width } = useWindowDimensions();

  const list = useActiveList();
  const recommendations = useMealRecommendations(list?.id);
  const { load } = recommendations;
  const [dismissedSuggestion, setDismissedSuggestion] = useState<string | null>(
    null,
  );
  const reminderDate =
    at && at !== dismissedSuggestion && list?.id && dinnerSuggestion === list.id
      ? dates.some((day) => dateKey(day) === requestedDate) && requestedDate
      : undefined;
  const scroll = useRef<ScrollViewInstance>(null);
  const scrollContent = useRef<ComponentRef<typeof View>>(null);
  const scrollY = useRef(0);
  const beforeTypingY = useRef<number | null>(null);
  const [focusedChooser, setFocusedChooser] = useState<{
    frame: ChooserFrame;
    target: MealTarget;
  } | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const headerHeight = useHeaderHeight();
  const keyboardHeight = useKeyboardState((state) => state.height);
  const pinnedChooser = keyboardHeight > 0 ? focusedChooser : null;
  const pinnedFrame = pinnedChooser?.frame ?? null;
  const typing = pinnedChooser !== null;

  function onChooserFocusChange(
    frame: ChooserFrame,
    target: MealTarget | null,
  ) {
    if (target) {
      if (!typing) beforeTypingY.current = scrollY.current;
      setFocusedChooser({ frame, target });
    } else {
      setFocusedChooser((current) =>
        current?.frame === frame ? null : current,
      );
    }
  }

  const alignChooser = useCallback(() => {
    if (!pinnedFrame?.current || !scrollContent.current) return;
    pinnedFrame.current.measureLayout(scrollContent.current, (_x, y) => {
      scroll.current?.scrollTo({ y, animated: false });
    });
  }, [pinnedFrame]);

  useLayoutEffect(() => {
    if (!pinnedFrame) return;
    const frame = requestAnimationFrame(alignChooser);
    return () => cancelAnimationFrame(frame);
  }, [alignChooser, pinnedFrame, viewportHeight]);

  useLayoutEffect(() => {
    if (typing) return;
    if (beforeTypingY.current === null) return;
    const y = beforeTypingY.current;
    const frame = requestAnimationFrame(() => {
      beforeTypingY.current = null;
      scroll.current?.scrollTo({ y, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [typing]);
  useEffect(() => {
    if (!reminderDate || !at) return;
    void load(reminderDate, "dinner", "reminder");
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [at, load, reminderDate]);
  const selectingSlots = useRef(new Set<string>());
  const [selecting, setSelecting] = useState<Set<string>>(new Set());

  const { data: planned, isLoading: historyLoading } = useQuery<ShoppingMeal>(
    `${MEALS_WITH_SHOPPING} WHERE pm.list_id = ?`,
    [list?.id ?? ""],
  );
  const { data: variants } = useQuery<DbVariant & { art_path: string | null }>(
    `SELECT v.*, r.art_path FROM variants v LEFT JOIN recipes r ON r.id = v.recipe_id
     ORDER BY v.created_at DESC`,
  );
  const { session } = useAuth();
  const { data: peopleRows } = useQuery<{
    id: string;
    name: string;
    user_id: string | null;
  }>(
    "SELECT id, name, user_id FROM household_people WHERE list_id = ? ORDER BY created_at, id",
    [list?.id ?? ""],
  );
  const people = useMemo(
    () => toEaters(peopleRows, session?.user.id),
    [peopleRows, session],
  );

  const variantById = useMemo(
    () => new Map(variants.map((v) => [v.id, v])),
    [variants],
  );
  const todayKey = useToday();
  const recentMeals = useMemo(
    (): RecentMealReference[] =>
      list
        ? recentMealReferences(planned, list.id, todayKey).map((meal) => ({
            plannedMealId: meal.id,
            contentId: meal.content_id,
            date: meal.slot_date,
            variantId: meal.variant_id,
            name: meal.display_name,
            artPath: variantById.get(meal.variant_id ?? "")?.art_path,
          }))
        : [],
    [list, planned, todayKey, variantById],
  );
  const selIndex = Math.max(
    0,
    dates.findIndex((d) => dateKey(d) === selected),
  );
  const selectDay = useCallback((day: string) => {
    Keyboard.dismiss();
    setSelected(day);
  }, []);
  const commitDay = useCallback(
    (index: number) => selectDay(dateKey(dates[index]!)),
    [dates, selectDay],
  );
  const { gesture: dayPan, dragStyle } = usePanSwipeDay({
    width,
    count: dates.length,
    index: selIndex,
    onCommit: commitDay,
    enabled: !typing,
  });

  function plannedFor(date: string, slot: MealSlot): DisplayPlannedMeal | null {
    const k = slotKey(list?.id, date, slot);
    if (k in pending) return pending[k] ?? null;
    const row = planned.find(
      (p) => p.list_id === list?.id && p.slot_date === date && p.meal === slot,
    );
    if (!row) return null;
    const v = row.variant_id ? variantById.get(row.variant_id) : null;
    const eaterIds = parseEaterIds(row.eater_ids);
    const extraPortions = row.extra_portions ?? 0;
    return {
      id: row.variant_id ?? row.id,
      variantId: row.variant_id,
      shoppingReviewed: !!row.shopping_reviewed,
      recipeId: row.recipe_id,
      name: row.name ?? v?.name ?? "…",
      totalTime: v?.total_time ?? null,
      artPath: v?.art_path ?? null,
      eaterIds,
      extraPortions,
      eatersLabel: eatersLabel({ people, eaterIds, extraPortions }),
    };
  }

  // clear optimistic pending once the real row arrives / disappears
  useEffect(() => {
    for (const [k, p] of Object.entries(pending)) {
      const [listId, date, slot] = k.split(":");
      if (listId !== list?.id) continue;
      const row = planned.find(
        (r) => r.list_id === listId && r.slot_date === date && r.meal === slot,
      );
      if ((p === null && !row) || (p && row?.variant_id === p.variantId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing optimistic pending once PowerSync catches up
        setPending((prev) => {
          const next = { ...prev };
          delete next[k];
          return next;
        });
      }
    }
  }, [list?.id, planned, pending]);

  function setOpen(date: string, slot: MealSlot, open: boolean) {
    if (date === reminderDate && slot === "dinner" && at) {
      setDismissedSuggestion(at);
    }
    if (open) void load(date, slot);
    setOpenSlots((prev) => {
      const next = new Set(prev);
      const k = slotKey(list?.id, date, slot);
      if (open) next.add(k);
      else next.delete(k);
      return next;
    });
  }

  async function onPlan(date: string, slot: MealSlot, recipe: DisplayRecipe) {
    if (!list) return;
    const k = slotKey(list.id, date, slot);
    if (selectingSlots.current.has(k)) return;
    selectingSlots.current.add(k);
    setSelecting(new Set(selectingSlots.current));
    try {
      recipe = await prepareRecommendedMeal(list.id, recipe);
      // Same default the write applies: everyone in the household, no extra.
      const eaterIds = people.map((p) => p.id);
      setPending((prev) => ({
        ...prev,
        [k]: {
          ...recipe,
          variantId: recipe.id,
          shoppingReviewed: false,
          eaterIds,
          extraPortions: 0,
          eatersLabel: eatersLabel({ people, eaterIds, extraPortions: 0 }),
        },
      }));
      setOpen(date, slot, false);
      // DisplayRecipe id is now variant id (ADR 8)
      const v = variantById.get(recipe.id);
      await setPlannedMeal({
        listId: list.id,
        slotDate: date,
        meal: slot,
        recipeId: recipe.recipeId ?? v?.recipe_id ?? recipe.id,
        variantId: recipe.id,
      });
    } catch (error) {
      // rollback optimistic on failure
      setPending((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      setOpen(date, slot, true);
      Alert.alert(
        intl.formatMessage({
          defaultMessage: "Couldn’t plan this meal",
          description: "Alert title when a chosen meal could not be saved.",
        }),
        error instanceof MealRecommendationError &&
          error.reason === "not-synced"
          ? intl.formatMessage({
              defaultMessage:
                "The recipe hasn’t synced yet. Try again in a moment.",
              description:
                "Alert body when a recommendation was chosen before its recipe finished syncing.",
            })
          : intl.formatMessage({
              defaultMessage: "Please try again.",
              description:
                "Generic alert body after planning a meal failed for an unknown reason.",
            }),
      );
    } finally {
      selectingSlots.current.delete(k);
      setSelecting(new Set(selectingSlots.current));
    }
  }

  async function onHideOpen(date: string, slot: MealSlot) {
    setOpen(date, slot, false);
  }

  async function changeMeal(date: string, slot: MealSlot) {
    if (!list) return;
    const k = slotKey(list?.id, date, slot);
    setPending((prev) => ({ ...prev, [k]: null }));
    setOpen(date, slot, true);
    try {
      await clearPlannedMeal(list.id, date, slot);
    } catch {
      setPending((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  }

  async function skipMeal(date: string, slot: MealSlot) {
    if (!list) return;
    const k = slotKey(list?.id, date, slot);
    setPending((prev) => ({ ...prev, [k]: null }));
    setOpen(date, slot, false);
    try {
      await clearPlannedMeal(list.id, date, slot);
    } catch {
      setPending((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
    }
  }

  function openImport(date: string, slot: MealSlot) {
    router.push({ pathname: "/cookbook/import", params: { slot, date } });
  }

  function startSlotChat(
    date: string,
    slot: MealSlot,
    entry: "on_hand" | "dish",
    dish?: string,
  ) {
    if (!list) return;
    const chatId = Crypto.randomUUID();
    if (dish) {
      queueMessage({
        chatId,
        listId: list.id,
        messageId: Crypto.randomUUID(),
        text: slotEntryMessage({ date, slot }, dishMessage(dish)),
        attachments: [],
      });
    }
    router.push({
      pathname: "/chats/[id]",
      params: { id: chatId, date, slot, entry, listId: list.id },
    });
  }

  function startRhyme(date: string, slot: MealSlot, meal: RecentMealReference) {
    if (!list || !recentMeals.includes(meal)) return;
    const chatId = Crypto.randomUUID();
    queueMessage({
      chatId,
      listId: list.id,
      messageId: Crypto.randomUUID(),
      text: slotEntryMessage(
        { date, slot },
        intl.formatMessage(
          {
            defaultMessage: "Give me three meal ideas like {meal}.",
            description:
              "Chat message sent when the cook chooses a recent meal as inspiration. {meal} is the name of the selected meal.",
          },
          { meal: meal.name },
        ),
      ),
      attachments: [],
      rhymeReference: {
        plannedMealId: meal.plannedMealId,
        contentId: meal.contentId,
        locale: intl.locale,
      },
    });
    router.push({
      pathname: "/chats/[id]",
      params: { id: chatId, date, slot, listId: list.id },
    });
  }

  function editEaters(
    date: string,
    slot: MealSlot,
    recipe: DisplayPlannedMeal | null,
  ) {
    if (!list || !recipe) return;
    router.push({
      pathname: "/meals/eaters",
      params: {
        listId: list.id,
        date,
        slot,
        variantId: recipe.variantId ?? "",
        eaterIds: JSON.stringify(recipe.eaterIds),
        extraPortions: String(recipe.extraPortions),
      },
    });
  }

  function moveMeal(
    date: string,
    slot: MealSlot,
    recipe: DisplayPlannedMeal | null,
    repeat = false,
  ) {
    if (!list) return;
    router.push({
      pathname: "/meals/move",
      params: {
        listId: list.id,
        date,
        slot,
        variantId: recipe?.variantId ?? "",
        mode: repeat ? "repeat" : "move",
      },
    });
  }

  function dayPage(date: Date, index: number) {
    const key = dateKey(date);
    const isReminderSlot = (slot: MealSlot) =>
      key === reminderDate && slot === "dinner";
    // Only the selected day and its neighbours mount; the rest hold their slot.
    if (!list || Math.abs(index - selIndex) > 1)
      return <View key={key} style={{ width }} />;
    return (
      <View key={key} style={{ width }}>
        <DayContent
          date={date}
          isToday={key === todayKey}
          dayPan={dayPan}
          list={list}
          importJobs={importJobs}
          plannedFor={plannedFor}
          dinnerSuggestion={key === reminderDate ? at : undefined}
          recentMeals={recentMeals}
          historyLoading={historyLoading}
          recommendations={(slot) => {
            const found = recommendations.get(
              key,
              slot,
              isReminderSlot(slot) ? "reminder" : "live",
            );
            return {
              ...found,
              recipes: found.recipes.map((recipe) => ({
                ...recipe,
                artPath: variantById.get(recipe.id)?.art_path ?? null,
              })),
            };
          }}
          isSelecting={(slot) => selecting.has(slotKey(list.id, key, slot))}
          onRetry={(slot) =>
            void load(key, slot, isReminderSlot(slot) ? "reminder" : "live")
          }
          isOpen={(slot) =>
            isReminderSlot(slot) || openSlots.has(slotKey(list.id, key, slot))
          }
          onPlan={(slot, r) => void onPlan(key, slot, r)}
          onEditEaters={(slot, r) => editEaters(key, slot, r)}
          onChange={(slot) => void changeMeal(key, slot)}
          onSkip={(slot) => void skipMeal(key, slot)}
          onMove={(slot, r) => moveMeal(key, slot, r)}
          onRepeat={(slot, r) => moveMeal(key, slot, r, true)}
          onHide={(slot) => void onHideOpen(key, slot)}
          onSetOpen={(slot, open) => setOpen(key, slot, open)}
          onImport={(slot) => openImport(key, slot)}
          onStartChat={(slot, entry, dish) =>
            startSlotChat(key, slot, entry, dish)
          }
          onRhyme={(slot, meal) => startRhyme(key, slot, meal)}
          onCookbook={(slot) =>
            router.push({
              pathname: "/meals/pick",
              params: { slot, date: key },
            })
          }
          onWriteIn={(slot) =>
            router.push({
              pathname: "/meals/write",
              params: { slot, date: key },
            })
          }
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: pinnedChooser
            ? formatMealTarget(intl, pinnedChooser.target)
            : intl.formatMessage({
                defaultMessage: "Meals",
                description: "Title of the meal planning screen.",
              }),
          headerLargeTitle: !typing,
          headerLeft:
            list && !typing
              ? () => (
                  <Pressable
                    onPress={() => router.push("/household")}
                    hitSlop={8}
                    accessibilityLabel={intl.formatMessage({
                      defaultMessage: "Household and account",
                      description:
                        "Accessibility label for the household settings shortcut.",
                    })}
                    accessibilityRole="button"
                    className="p-1"
                  >
                    <HouseholdAvatars listId={list.id} />
                  </Pressable>
                )
              : undefined,
          headerRight: typing
            ? undefined
            : () => (
                <Pressable
                  onPress={() => router.push("/chats/history")}
                  accessibilityLabel={intl.formatMessage({
                    defaultMessage: "Past chats",
                    description:
                      "Accessibility label for the shortcut to household chat history.",
                  })}
                  accessibilityRole="button"
                  className="min-h-11 justify-center px-2 active:opacity-60"
                >
                  <SymbolView
                    name={{ ios: "clock.arrow.circlepath", android: "history" }}
                    tintColor={iconColor}
                    size={22}
                  />
                </Pressable>
              ),
        }}
      />
      {!list ? (
        <View className="flex-1 items-center justify-center gap-3 bg-background p-6">
          <Text variant="muted">
            {intl.formatMessage({
              defaultMessage: "No list yet — create one in Shop first.",
              description:
                "Empty state on Meals when the household has no active shopping list.",
            })}
          </Text>
          <ActivityIndicator />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{
            flex: 1,
            // Typing owns the viewport insets while the iOS scroll view is pinned.
            paddingTop:
              typing && process.env.EXPO_OS === "ios" ? headerHeight : 0,
          }}
          behavior="padding"
          automaticOffset
          enabled={process.env.EXPO_OS === "ios" && focusedChooser !== null}
        >
          <ScrollView
            ref={scroll}
            className="flex-1 bg-background"
            contentInsetAdjustmentBehavior={typing ? "never" : "automatic"}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEnabled={!typing}
            contentContainerClassName="flex-grow"
            onLayout={(event) =>
              setViewportHeight(event.nativeEvent.layout.height)
            }
            onScroll={(event) => {
              scrollY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            onContentSizeChange={alignChooser}
          >
            <View ref={scrollContent} collapsable={false} className="grow">
              <View className="mt-4">
                <DayStrip
                  dates={dates}
                  todayIndex={todayIndex}
                  selected={selected}
                  onSelect={selectDay}
                />
              </View>

              <GestureDetector gesture={dayPan}>
                <Animated.View
                  style={[
                    dragStyle,
                    {
                      flexGrow: 1,
                      flexDirection: "row",
                      overflow: "hidden",
                      paddingBottom: 40,
                      // explicit: a stretched row would be viewport-wide and the
                      // page offset would push every page off-screen
                      width: width * dates.length,
                    },
                  ]}
                >
                  <MealTypingLayout
                    value={{
                      height: viewportHeight,
                      pinnedFrame,
                      onFocusChange: onChooserFocusChange,
                    }}
                  >
                    {dates.map(dayPage)}
                  </MealTypingLayout>
                </Animated.View>
              </GestureDetector>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </>
  );
}
