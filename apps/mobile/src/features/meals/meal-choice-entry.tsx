import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import {
  createContext,
  use,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useIntl } from "react-intl";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useResolveClassNames } from "uniwind";

import { EditorSheet, type EditorSheetHandle } from "@/components/editor-sheet";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { setWrittenMeal } from "@/db/planned-meals";
import { useRecipeChoices } from "@/features/cookbook/use-recipe-choices";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { posthog } from "@/lib/posthog";
import type { DisplayRecipe, RecentMealReference } from "./day-content";
import { formatChooserTitle } from "./labels";
import { RECIPE_LIST_TILE_SIZE, RecipeArt, RecipeListArt } from "./recipe-art";
import { seededLook } from "./seeded-look";
import type { MealSlot, MealTarget } from "./slots";

type Reference = Pick<RecentMealReference, "plannedMealId" | "contentId">;
export type ChooserFrame = RefObject<ComponentRef<typeof View> | null>;

export const MealTypingLayout = createContext<{
  pinnedFrame: ChooserFrame | null;
  height: number;
  onFocusChange: (frame: ChooserFrame, target: MealTarget | null) => void;
} | null>(null);

export function MealChoiceEntry({
  date,
  slot,
  listId,
  recentMeals,
  historyLoading,
  selecting,
  suggestions,
  onClose,
  onPlan,
  onUseIngredients,
  onStartDish,
  onRhyme,
  onCookbook,
  onImport,
}: {
  date: string;
  slot: MealSlot;
  listId: string;
  recentMeals: RecentMealReference[];
  historyLoading: boolean;
  selecting: boolean;
  suggestions: ReactNode;
  onClose: () => void;
  onPlan: (recipe: DisplayRecipe) => void;
  onUseIngredients: () => void;
  onStartDish: (dish: string) => void;
  onRhyme: (meal: RecentMealReference) => void;
  onCookbook: () => void;
  onImport: () => void;
}) {
  const intl = useIntl();
  const layout = use(MealTypingLayout);
  const frame = useRef<ComponentRef<typeof View>>(null);
  const pinned = layout?.pinnedFrame === frame;
  const [resultsHeight, setResultsHeight] = useState(0);
  const sheet = useRef<EditorSheetHandle>(null);
  const pendingReference = useRef<Reference | null>(null);
  const [search, setSearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reference, setReference] = useState<Reference | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  const writing = useRef(false);
  const name = search.trim();
  const disabled = selecting || isWriting;
  const muted = useResolveClassNames("text-muted-foreground").color;
  const primary = useResolveClassNames("text-primary").color;
  const { height } = useWindowDimensions();
  const inputLabel = intl.formatMessage({
    defaultMessage: "Type a dish",
    description:
      "Empty meal chooser input. Typing searches saved recipes and lets the cook ask for help or plan their own dish.",
  });

  function handoff(action: () => void) {
    Keyboard.dismiss();
    action();
  }

  function confirmReference(meal: RecentMealReference) {
    if (pendingReference.current || disabled || !sheet.current) return;
    pendingReference.current = meal;
    sheet.current.dismiss();
  }

  function dismissHistory() {
    const selected = pendingReference.current;
    pendingReference.current = null;
    setHistoryOpen(false);
    setReference(null);
    if (!selected || historyLoading) return;
    const meal = recentMeals.find(
      (meal) =>
        meal.plannedMealId === selected.plannedMealId &&
        meal.contentId === selected.contentId,
    );
    if (meal) onRhyme(meal);
  }

  async function saveWrittenMeal() {
    if (!name || writing.current || disabled) return;
    writing.current = true;
    setIsWriting(true);
    setWriteFailed(false);
    Keyboard.dismiss();
    try {
      await setWrittenMeal({ listId, slotDate: date, meal: slot, name });
      posthog?.capture("written_meal_saved", {
        meal_slot: slot,
        is_edit: false,
      });
      onClose();
    } catch {
      setWriteFailed(true);
    } finally {
      writing.current = false;
      setIsWriting(false);
    }
  }

  const footer = (
    <View className="flex-row flex-wrap gap-x-3 border-t border-border pt-1">
      <Button
        variant="ghost"
        className="h-auto min-h-11 flex-1 px-1 py-2"
        disabled={disabled}
        onPress={() => handoff(onCookbook)}
      >
        <Text className="text-center text-sm text-muted-foreground">
          {intl.formatMessage({
            defaultMessage: "Browse cookbook",
            description:
              "Action opening the full cookbook to select a recipe for this meal slot.",
          })}
        </Text>
      </Button>
      <Button
        variant="ghost"
        className="h-auto min-h-11 flex-1 px-1 py-2"
        disabled={disabled}
        onPress={() => handoff(onImport)}
      >
        <Text className="text-center text-sm text-muted-foreground">
          {intl.formatMessage({
            defaultMessage: "Import recipe",
            description:
              "Action that opens recipe import from an open meal slot.",
          })}
        </Text>
      </Button>
    </View>
  );

  const dishActions = name ? (
    <View className="shrink-0 gap-1.5 border-t border-border pt-2.5">
      <Text
        numberOfLines={1}
        className="font-rounded text-sm font-bold text-primary"
      >
        {name}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Button
          className="h-auto min-h-11 min-w-32 flex-1 px-3 py-2.5"
          disabled={disabled}
          onPress={() => handoff(() => onStartDish(name))}
        >
          <Text className="shrink text-center">
            {intl.formatMessage({
              defaultMessage: "Help me make this",
              description:
                "Starts a cooking conversation about the dish in the meal slot’s text field.",
            })}
          </Text>
        </Button>
        <Button
          variant="ghost"
          className="h-auto min-h-11 min-w-32 flex-1 px-3 py-2.5"
          disabled={disabled}
          onPress={() => void saveWrittenMeal()}
        >
          <Text className="shrink text-center text-link">
            {intl.formatMessage({
              defaultMessage: "Save as written",
              description:
                "Adds the dish to the meal plan using the typed name, without creating a recipe.",
            })}
          </Text>
        </Button>
      </View>
      {writeFailed ? (
        <Text className="text-destructive" accessibilityRole="alert">
          {intl.formatMessage({
            defaultMessage: "Couldn’t add this meal. Try again.",
            description: "An attempt to save a written-in meal failed.",
          })}
        </Text>
      ) : null}
    </View>
  ) : null;

  return (
    <View
      ref={frame}
      collapsable={false}
      className={pinned ? "gap-2 py-2" : name ? "gap-2" : "gap-4"}
      style={pinned ? { height: layout.height } : undefined}
    >
      <TextInput
        accessibilityLabel={inputLabel}
        placeholder={inputLabel}
        placeholderTextColor={muted}
        selectionColor={primary}
        value={search}
        editable={!disabled}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        className="min-h-11 rounded-full bg-muted px-4 py-2.5 text-[17px] text-foreground disabled:opacity-50"
        onFocus={() => layout?.onFocusChange(frame, { date, slot })}
        onBlur={() => layout?.onFocusChange(frame, null)}
        onChangeText={(text) => {
          setSearch(text);
          setWriteFailed(false);
        }}
      />
      {pinned ? (
        <>
          <View
            className="flex-1 overflow-hidden"
            onLayout={(event) =>
              setResultsHeight(event.nativeEvent.layout.height)
            }
          >
            {name ? (
              <MatchingRecipes
                name={name}
                disabled={disabled}
                maxHeight={resultsHeight}
                onSelect={(recipe) => handoff(() => onPlan(recipe))}
              />
            ) : null}
          </View>
          {dishActions}
        </>
      ) : name ? (
        <>
          <MatchingRecipes
            name={name}
            disabled={disabled}
            maxHeight={220}
            onSelect={(recipe) => handoff(() => onPlan(recipe))}
          />
          {dishActions}
          {footer}
        </>
      ) : (
        <>
          {suggestions}
          <View>
            {recentMeals.length > 0 && (
              <ChoiceRow
                chevron
                disabled={disabled || historyLoading}
                onPress={() => handoff(() => setHistoryOpen(true))}
              >
                {intl.formatMessage({
                  defaultMessage: "Get an idea from a past meal",
                  description:
                    "Opens a list of past meals to choose one as inspiration for a new dish.",
                })}
              </ChoiceRow>
            )}
            <ChoiceRow
              chevron
              disabled={disabled}
              onPress={() => handoff(onUseIngredients)}
            >
              {intl.formatMessage({
                defaultMessage: "Start with ingredients",
                description:
                  "Starts a chat to find a meal for this slot using ingredients on hand.",
              })}
            </ChoiceRow>
          </View>
          {footer}
        </>
      )}
      {historyOpen && (
        <EditorSheet
          ref={sheet}
          compact
          title={formatChooserTitle(intl, { date, slot })}
          onDismiss={dismissHistory}
          closeLabel={intl.formatMessage({
            defaultMessage: "Close meal chooser",
            description:
              "Accessibility label for dismissing the open meal chooser.",
          })}
        >
          <RecentMealChoices
            meals={recentMeals}
            loading={historyLoading}
            slot={slot}
            reference={reference}
            maxHeight={Math.round(height * 0.45)}
            onSelect={setReference}
            onSubmit={confirmReference}
          />
        </EditorSheet>
      )}
    </View>
  );
}

function ChoiceRow({
  children,
  disabled,
  chevron,
  onPress,
}: {
  children: string;
  disabled?: boolean;
  chevron?: boolean;
  onPress: () => void;
}) {
  const muted = useResolveClassNames("text-muted-foreground").color;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className="min-h-11 flex-row items-center gap-2 py-2 active:opacity-60 disabled:opacity-50"
    >
      <Text className="flex-1 font-medium">{children}</Text>
      {chevron ? (
        <SymbolView
          name={{ ios: "chevron.forward", android: "chevron_right" }}
          size={13}
          tintColor={muted}
        />
      ) : null}
    </Pressable>
  );
}

function MatchingRecipes({
  name,
  disabled,
  maxHeight,
  onSelect,
}: {
  name: string;
  disabled: boolean;
  maxHeight: number;
  onSelect: (recipe: DisplayRecipe) => void;
}) {
  const intl = useIntl();
  const { fontScale } = useWindowDimensions();
  const headingHeight = Math.ceil(18 * fontScale) + 8;
  const listHeight = maxHeight - headingHeight;
  const rowPadding = 21;
  const titleLines =
    listHeight >= Math.ceil(60 * fontScale) + rowPadding ? 3 : 2;
  const rowHeight =
    Math.max(RECIPE_LIST_TILE_SIZE, Math.ceil(20 * fontScale * titleLines)) +
    rowPadding;
  const visibleCount = Math.floor(listHeight / rowHeight);
  const addColor = useResolveClassNames("text-link").color;
  const { choices, isLoading } = useRecipeChoices(name);
  if (isLoading)
    return <ActivityIndicator size="small" className="self-start" />;
  if (!choices.length)
    return (
      <Text variant="muted" className="py-2 text-sm">
        {intl.formatMessage({
          defaultMessage: "No matching recipes in your cookbook.",
          description:
            "Search found no saved recipes. The cook can still ask for help or save the text as a written meal.",
        })}
      </Text>
    );
  if (visibleCount <= 0) return null;
  return (
    <View>
      <Text
        accessibilityRole="header"
        className="px-1 pb-1 pt-1 text-sm font-medium leading-[18px] text-muted-foreground"
      >
        {intl.formatMessage({
          defaultMessage: "From your cookbook",
          description:
            "Heading that identifies matching saved recipes when the cook types a dish in the meal chooser.",
        })}
      </Text>
      <View>
        {choices.slice(0, visibleCount).map(({ variant, artPath }, index) => (
          <Pressable
            key={variant.id}
            accessibilityRole="button"
            className={`flex-row items-center gap-4 pt-3 pb-2 active:bg-accent disabled:opacity-50 ${index > 0 ? "border-t border-border/40" : ""}`}
            disabled={disabled}
            accessibilityLabel={intl.formatMessage(
              {
                defaultMessage: "Plan {name}",
                description:
                  "Action for a cookbook search match that adds the recipe to the open meal slot. {name} is the recipe name.",
              },
              { name: variant.name ?? "" },
            )}
            onPress={() =>
              onSelect({
                id: variant.id,
                recipeId: variant.recipe_id,
                name: variant.name ?? "",
                totalTime: variant.total_time,
                artPath,
              })
            }
          >
            <RecipeListArt
              id={variant.id}
              name={variant.name}
              artPath={artPath}
            />
            <Text
              numberOfLines={titleLines}
              className="flex-1 font-medium leading-5"
            >
              {variant.name}
            </Text>
            <SymbolView
              name={{ ios: "plus", android: "add" }}
              size={18}
              tintColor={addColor}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function RecentMealChoices({
  meals,
  loading,
  slot,
  maxHeight,
  reference,
  onSelect,
  onSubmit,
}: {
  meals: RecentMealReference[];
  loading: boolean;
  slot: MealSlot;
  maxHeight: number;
  reference: Pick<RecentMealReference, "plannedMealId" | "contentId"> | null;
  onSelect: (meal: RecentMealReference) => void;
  onSubmit: (meal: RecentMealReference) => void;
}) {
  const intl = useIntl();
  const dark = useColorScheme() === "dark";
  const muted = useResolveClassNames("text-muted-foreground").color;
  const chosen = meals.find(
    (meal) =>
      meal.plannedMealId === reference?.plannedMealId &&
      meal.contentId === reference.contentId,
  );
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-base font-semibold">
          {intl.formatMessage(
            {
              defaultMessage:
                "{slot, select, lunch {Which meal should inspire lunch?} dinner {Which meal should inspire dinner?} treat {Which meal should inspire a treat?} other {Which meal should inspire a new dish?}}",
              description:
                "Heading before selecting a past meal as inspiration for a new dish. Selector values are lunch, dinner and treat.",
            },
            { slot },
          )}
        </Text>
        <Text variant="muted" className="text-sm">
          {meals.length || loading
            ? intl.formatMessage({
                defaultMessage:
                  "Pick a past meal and Magpie will suggest a new dish.",
                description:
                  "Explains that the selected past meal is inspiration for a new dish suggestion.",
              })
            : intl.formatMessage({
                defaultMessage: "There are no past meals to choose from.",
                description:
                  "Shown when the history picker no longer has any past meals available.",
              })}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" />
      ) : meals.length ? (
        <>
          <ScrollView style={{ maxHeight }} nestedScrollEnabled>
            {meals.map((meal) => (
              <Pressable
                key={meal.plannedMealId}
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen === meal }}
                onPress={() => onSelect(meal)}
                className="min-h-14 flex-row items-center gap-3 border-b border-border py-2 active:opacity-60"
              >
                <View className="size-10 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  <LinearGradient
                    colors={tonalPair(
                      meal.variantId ?? meal.plannedMealId,
                      dark,
                    )}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={{ position: "absolute", inset: 0 }}
                  />
                  {meal.artPath || seededLook(meal.name) ? (
                    <RecipeArt
                      name={meal.name}
                      artPath={meal.artPath}
                      inset={4}
                    />
                  ) : (
                    <SymbolView
                      name={{ ios: "fork.knife", android: "restaurant" }}
                      size={16}
                      tintColor={muted}
                    />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium">{meal.name}</Text>
                  <Text variant="muted" className="text-xs">
                    {intl.formatDate(new Date(`${meal.date}T12:00:00`), {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
                <View className="w-5 items-center">
                  {chosen === meal ? (
                    <SymbolView
                      name={{ ios: "checkmark", android: "check" }}
                      size={17}
                      tintColor={muted}
                    />
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <Button
            disabled={!chosen}
            onPress={() => chosen && onSubmit(chosen)}
            className="h-auto min-h-11 py-2"
          >
            <Text className="text-center">
              {intl.formatMessage(
                {
                  defaultMessage:
                    "{slot, select, lunch {Suggest a new lunch} dinner {Suggest a new dinner} treat {Suggest a new treat} other {Suggest a new dish}}",
                  description:
                    "Confirms the selected past meal as inspiration and starts a chat for a new suggestion. Selector values are lunch, dinner and treat.",
                },
                { slot },
              )}
            </Text>
          </Button>
        </>
      ) : null}
    </View>
  );
}
