import { useQuery } from "@powersync/react";
import { Link, Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { useAuth } from "@/db/provider";
import type { Variant as DbVariant } from "@/db/schema";
import { MEALS_WITH_SHOPPING, type ShoppingMeal } from "@/db/shopping-meals";
import { clearPlannedMeal, setPlannedMeal } from "@/db/planned-meals";
import {
  DayContent,
  type DisplayPlannedMeal,
  type DisplayRecipe,
} from "@/features/meals/day-content";
import { DayStrip } from "@/features/meals/day-strip";
import { eatersLabel, parseEaterIds, toEaters } from "@/features/meals/eaters";
import { dateKey, stripDates, type MealSlot } from "@/features/meals/slots";
import { usePanSwipeDay } from "@/features/meals/use-pan-swipe-day";
import { useImportJobs } from "@/features/meals/use-import-jobs";
import { useActiveList } from "@/features/onboarding/access";
import {
  prepareRecommendedMeal,
  useMealRecommendations,
} from "@/features/meals/use-meal-recommendations";
import { useToday } from "@/hooks/use-today";

export default function Meals() {
  const [{ dates, todayIndex }] = useState(stripDates);
  const { date: requestedDate, at } = useLocalSearchParams<{
    date?: string;
    at?: string;
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
  const selectingSlots = useRef(new Set<string>());
  const [selecting, setSelecting] = useState<Set<string>>(new Set());

  const { data: planned } = useQuery<ShoppingMeal>(
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
  const selIndex = Math.max(
    0,
    dates.findIndex((d) => dateKey(d) === selected),
  );
  const commitDay = useCallback(
    (index: number) => setSelected(dateKey(dates[index]!)),
    [dates],
  );
  const { gesture: dayPan, dragStyle } = usePanSwipeDay({
    width,
    count: dates.length,
    index: selIndex,
    onCommit: commitDay,
  });

  function plannedFor(date: string, slot: MealSlot): DisplayPlannedMeal | null {
    const k = `${date}:${slot}`;
    if (k in pending) return pending[k] ?? null;
    const row = planned.find((p) => p.slot_date === date && p.meal === slot);
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
      const [date, slot] = k.split(":") as [string, MealSlot];
      const row = planned.find((r) => r.slot_date === date && r.meal === slot);
      if ((p === null && !row) || (p && row?.variant_id === p.variantId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing optimistic pending once PowerSync catches up
        setPending((prev) => {
          const next = { ...prev };
          delete next[k];
          return next;
        });
      }
    }
  }, [planned, pending]);

  function setOpen(date: string, slot: MealSlot, open: boolean) {
    if (open) void recommendations.load(date, slot);
    setOpenSlots((prev) => {
      const next = new Set(prev);
      const k = `${date}:${slot}`;
      if (open) next.add(k);
      else next.delete(k);
      return next;
    });
  }

  async function onPlan(date: string, slot: MealSlot, recipe: DisplayRecipe) {
    if (!list) return;
    const k = `${date}:${slot}`;
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
        "Couldn’t plan this meal",
        error instanceof Error ? error.message : "Please try again.",
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
    const k = `${date}:${slot}`;
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
    const k = `${date}:${slot}`;
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
          recommendations={(slot) => {
            const found = recommendations.get(key, slot);
            return {
              ...found,
              recipes: found.recipes.map((recipe) => ({
                ...recipe,
                artPath: variantById.get(recipe.id)?.art_path ?? null,
              })),
            };
          }}
          isSelecting={(slot) => selecting.has(`${key}:${slot}`)}
          onRetry={(slot) => void recommendations.load(key, slot)}
          isOpen={(slot) => openSlots.has(`${key}:${slot}`)}
          onPlan={(slot, r) => void onPlan(key, slot, r)}
          onEditEaters={(slot, r) => editEaters(key, slot, r)}
          onChange={(slot) => void changeMeal(key, slot)}
          onSkip={(slot) => void skipMeal(key, slot)}
          onMove={(slot, r) => moveMeal(key, slot, r)}
          onRepeat={(slot, r) => moveMeal(key, slot, r, true)}
          onHide={(slot) => void onHideOpen(key, slot)}
          onSetOpen={(slot, open) => setOpen(key, slot, open)}
          onImport={(slot) => openImport(key, slot)}
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

  if (!list) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-background p-6">
        <Text variant="muted">No list yet — create one in Shop first.</Text>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Meals",
          headerLargeTitle: true,
          headerBackButtonDisplayMode: "minimal",
          headerRight: () => (
            <Link href="/meals/plan" asChild>
              <Pressable
                accessibilityRole="link"
                className="min-h-11 justify-center px-2 active:opacity-60"
              >
                <Text className="text-link">Plan with Magpie</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="flex-grow"
      >
        <View className="mt-4">
          <DayStrip
            dates={dates}
            todayIndex={todayIndex}
            selected={selected}
            onSelect={setSelected}
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
            {dates.map(dayPage)}
          </Animated.View>
        </GestureDetector>
      </ScrollView>
    </>
  );
}
