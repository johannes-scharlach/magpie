import { useQuery } from "@powersync/react";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, useColorScheme, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { clayTile, SectionTitle } from "@/components/clay";
import { Text } from "@/components/ui/text";
import { tonalPair } from "@/features/variants/tonal";
import { cn } from "@/lib/utils";

import {
  addDays,
  dateKey,
  SLOT_LABEL,
  SLOT_ORDER,
  WEEKDAY_LONG,
  type MealSlot,
} from "./slots";

const CHEVRON_ICON = {
  ios: "chevron.right",
  android: "chevron_right",
} as const;
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const GRID_MEALS: MealSlot[] = ["lunch", "dinner"];
const THUMB = 56;

type WeekMeal = {
  id: string;
  variant_id: string | null;
  meal: MealSlot;
  slot_date: string;
  name: string | null;
};

/**
 * Home's glance at the plan: today's meals as rows, then the next seven
 * days as the planning screen's own lunch/dinner grid, shrunk.
 */
export function WeekGlance({ listId }: { listId: string | null }) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(now, i));
  const todayKey = dateKey(now);
  const { data: meals } = useQuery<WeekMeal>(
    listId
      ? `SELECT p.id, p.variant_id, p.meal, p.slot_date, COALESCE(p.name, v.name) AS name
         FROM planned_meals p LEFT JOIN variants v ON v.id = p.variant_id
         WHERE p.list_id = ? AND p.slot_date BETWEEN ? AND ?`
      : "SELECT * FROM planned_meals WHERE 0",
    listId ? [listId, todayKey, dateKey(addDays(now, 6))] : [],
  );

  const today = meals
    .filter((m) => m.slot_date === todayKey)
    .sort((a, b) => SLOT_ORDER.indexOf(a.meal) - SLOT_ORDER.indexOf(b.meal));
  const planned = new Map(meals.map((m) => [`${m.slot_date}:${m.meal}`, m]));
  const dark = useColorScheme() === "dark";
  const empty = meals.length === 0;
  const weekHref = {
    pathname: "/meals",
    params: { date: todayKey },
  } as const;

  return (
    <View className="mx-4 gap-8">
      {today.length ? (
        <View className="gap-3">
          <SectionTitle>Today</SectionTitle>
          <View className="overflow-hidden bg-card" style={clayTile}>
            {today.map((meal, index) => (
              <View key={meal.id}>
                {index > 0 ? (
                  <View
                    className="border-t border-border"
                    style={{ marginLeft: 16 + THUMB + 12 }}
                  />
                ) : null}
                <TodayRow meal={meal} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <SectionTitle className="min-w-0 flex-1">This week</SectionTitle>
          <Link href={weekHref} asChild>
            <Pressable
              accessibilityRole="link"
              className="min-h-11 justify-center px-1 active:opacity-60"
            >
              <Text className="text-link">See week</Text>
            </Pressable>
          </Link>
        </View>
        {/* Keep day links usable without reserving empty lunch/dinner positions. */}
        <View className="overflow-hidden bg-card" style={clayTile}>
          <View className={cn("px-4", empty ? "py-1" : "py-3")}>
            <View className={cn("flex-row", !empty && "gap-1.5")}>
              {days.map((day, i) => {
                const k = dateKey(day);
                const dayPlannedCount = GRID_MEALS.filter((slot) =>
                  planned.has(`${k}:${slot}`),
                ).length;
                return (
                  <Link
                    key={k}
                    href={{ pathname: "/meals", params: { date: k } }}
                    asChild
                  >
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={`${i === 0 ? "Today, " : ""}${WEEKDAY_LONG[day.getDay()]}: ${dayPlannedCount} ${dayPlannedCount === 1 ? "meal" : "meals"} planned`}
                      className={cn(
                        "flex-1 items-center gap-1 py-1 active:opacity-60",
                        empty && "min-h-11 justify-center",
                      )}
                      hitSlop={{ top: 8, bottom: 8 }}
                    >
                      <Text
                        className={cn(
                          "text-[11px] text-foreground",
                          i === 0 ? "font-bold" : "font-medium",
                        )}
                      >
                        {WEEKDAY_LETTERS[day.getDay()]}
                      </Text>
                      {!empty &&
                        GRID_MEALS.map((slot) => {
                          const meal = planned.get(`${k}:${slot}`);
                          // A planned cell wears its recipe's tonalPair, like the Today row.
                          return meal ? (
                            <LinearGradient
                              key={slot}
                              colors={tonalPair(
                                meal.variant_id ?? meal.id,
                                dark,
                              )}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{
                                height: 10,
                                width: "100%",
                                borderRadius: 5,
                              }}
                            />
                          ) : (
                            // Keep each meal's position without drawing a placeholder.
                            <View key={slot} className="h-2.5 w-full" />
                          );
                        })}
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          </View>
          {empty ? (
            <Link href={weekHref} asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="No meals planned yet. Open Meals"
                className="min-h-11 flex-row items-center gap-3 px-4 py-2 active:bg-accent"
              >
                <Text variant="muted" className="flex-1">
                  No meals planned yet.
                </Text>
                <Chevron />
              </Pressable>
            </Link>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function TodayRow({ meal }: { meal: WeekMeal }) {
  const dark = useColorScheme() === "dark";
  return (
    <Link
      href={
        meal.variant_id
          ? {
              pathname: "/variant/[id]",
              params: { id: meal.variant_id, plannedMealId: meal.id },
            }
          : { pathname: "/meals/written", params: { id: meal.id } }
      }
      asChild
    >
      <Pressable
        accessibilityRole="link"
        className="flex-row items-center gap-3 px-4 py-3 active:bg-accent"
      >
        {/* Same tonalPair as the Meals card — one identity per recipe. */}
        <LinearGradient
          colors={tonalPair(meal.variant_id ?? meal.id, dark)}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={{ width: THUMB, height: THUMB, borderRadius: 12 }}
        />
        <View className="flex-1 gap-0.5">
          <Text
            className="text-[17px] font-semibold leading-snug"
            numberOfLines={2}
          >
            {meal.name ?? "…"}
          </Text>
          <Text variant="muted" className="text-sm">
            {SLOT_LABEL[meal.meal]}
          </Text>
        </View>
        <Chevron />
      </Pressable>
    </Link>
  );
}

function Chevron() {
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  return (
    <SymbolView
      name={CHEVRON_ICON}
      tintColor={mutedColor}
      size={14}
      weight="semibold"
    />
  );
}
