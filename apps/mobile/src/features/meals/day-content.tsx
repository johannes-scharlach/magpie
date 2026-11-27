import { useIntl } from "react-intl";
import { View } from "react-native";
import type { LegacyPanGesture } from "react-native-gesture-handler";

import { Text } from "@/components/ui/text";
import { plannedMealId } from "@/db/planned-meals";
import type { List } from "@/db/schema";
import { MealSection } from "@/features/meals/meal-section";
import { dateKey, SLOT_ORDER, type MealSlot } from "@/features/meals/slots";
import type { ImportJobs } from "@/features/meals/import-jobs";
import { ImportJobStatus } from "@/features/meals/import-job-status";
import { mealIsPast } from "@/features/meals/variant-meals";
import { useToday } from "@/hooks/use-today";
import { dayMessages, slotMessages } from "./labels";
import type { MealRecommendations } from "./use-meal-recommendations";

export type DisplayRecipe = {
  id: string;
  recipeId: string | null;
  name: string;
  totalTime: string | null;
  seedKey?: string | null;
  /** The recipe's drawn art (ADR 38); seeded dishes find theirs by name. */
  artPath?: string | null;
};
export type DisplayPlannedMeal = DisplayRecipe & {
  variantId: string | null;
  shoppingReviewed: boolean;
  eaterIds: string[];
  extraPortions: number;
  /** Rendered once here so the card and its menu agree. */
  eatersLabel: string;
};

export type RecentMealReference = {
  plannedMealId: string;
  contentId: string;
  date: string;
  variantId: string | null;
  name: string;
  artPath?: string | null;
};

type Props = {
  date: Date;
  isToday: boolean;
  dayPan: LegacyPanGesture;
  list: List;
  importJobs: ImportJobs;
  plannedFor: (date: string, slot: MealSlot) => DisplayPlannedMeal | null;
  dinnerSuggestion?: string;
  recentMeals: RecentMealReference[];
  historyLoading: boolean;
  recommendations: (slot: MealSlot) => MealRecommendations;
  isSelecting: (slot: MealSlot) => boolean;
  onRetry: (slot: MealSlot) => void;
  isOpen: (slot: MealSlot) => boolean;
  onPlan: (slot: MealSlot, recipe: DisplayRecipe) => void;
  onEditEaters: (slot: MealSlot, recipe: DisplayPlannedMeal | null) => void;
  onChange: (slot: MealSlot) => void;
  onSkip: (slot: MealSlot) => void;
  onMove: (slot: MealSlot, recipe: DisplayPlannedMeal | null) => void;
  onRepeat: (slot: MealSlot, recipe: DisplayPlannedMeal | null) => void;
  onHide: (slot: MealSlot) => void;
  onSetOpen: (slot: MealSlot, open: boolean) => void;
  onImport: (slot: MealSlot) => void;
  onStartChat: (
    slot: MealSlot,
    entry: "on_hand" | "dish",
    dish?: string,
  ) => void;
  onRhyme: (slot: MealSlot, meal: RecentMealReference) => void;
  onCookbook: (slot: MealSlot) => void;
  onWriteIn: (slot: MealSlot) => void;
};

/** Header + slot list for a single day. Pure render of its date's data. */
export function DayContent({
  date,
  isToday,
  dayPan,
  list,
  importJobs,
  plannedFor,
  dinnerSuggestion,
  recentMeals,
  historyLoading,
  recommendations,
  isSelecting,
  onRetry,
  isOpen,
  onPlan,
  onEditEaters,
  onChange,
  onSkip,
  onMove,
  onRepeat,
  onHide,
  onSetOpen,
  onImport,
  onStartChat,
  onRhyme,
  onCookbook,
  onWriteIn,
}: Props) {
  const today = useToday();
  const intl = useIntl();
  const dateStr = dateKey(date);

  return (
    <>
      <View className="mt-6 flex-row items-baseline gap-2 px-6">
        <Text variant="large">
          {isToday
            ? intl.formatMessage(dayMessages.today)
            : intl.formatDate(date, { weekday: "long" })}
        </Text>
        <Text variant="muted">
          {isToday ? `${intl.formatDate(date, { weekday: "long" })}, ` : ""}
          {intl.formatDate(date, { day: "numeric", month: "short" })}
        </Text>
      </View>

      <View className="mt-6 gap-8">
        {SLOT_ORDER.map((slot) => {
          const target = { listId: list.id, date: dateStr, slot };
          const job = importJobs.getForSlot(target);
          if (job) {
            return (
              <View
                key={slot}
                className="gap-3 px-6"
                accessibilityLiveRegion="polite"
              >
                <Text variant="muted">
                  {intl.formatMessage(slotMessages[slot])}
                </Text>
                <ImportJobStatus job={job} importJobs={importJobs} />
              </View>
            );
          }
          const recipe = plannedFor(dateStr, slot);
          const open = isOpen(slot);
          return (
            <MealSection
              key={slot}
              slot={slot}
              dayPan={dayPan}
              date={dateStr}
              plannedMealId={plannedMealId(list.id, dateStr, slot)}
              listId={list.id}
              recipe={recipe}
              open={open}
              onOpen={() => onSetOpen(slot, true)}
              reminderVisit={slot === "dinner" ? dinnerSuggestion : undefined}
              recentMeals={recentMeals}
              historyLoading={historyLoading}
              isPast={mealIsPast(dateStr, today)}
              showShoppingPrompt={
                !!recipe && !recipe.shoppingReviewed && dateStr >= today
              }
              contenders={recommendations(slot).recipes}
              recommendationsLoading={recommendations(slot).loading}
              recommendationsFailed={recommendations(slot).failed}
              selecting={isSelecting(slot)}
              onRetry={() => onRetry(slot)}
              onPlan={(r) => onPlan(slot, r)}
              onEditEaters={() => onEditEaters(slot, recipe)}
              onChange={() => onChange(slot)}
              onSkip={() => onSkip(slot)}
              onMove={() => onMove(slot, recipe)}
              onRepeat={() => onRepeat(slot, recipe)}
              onHide={() => onHide(slot)}
              onImport={() => onImport(slot)}
              onStartChat={(entry, dish) => onStartChat(slot, entry, dish)}
              onRhyme={(meal) => onRhyme(slot, meal)}
              onCookbook={() => onCookbook(slot)}
              onWriteIn={() => onWriteIn(slot)}
            />
          );
        })}
      </View>
    </>
  );
}
