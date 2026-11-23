import { useQuery } from "@powersync/react";
import { useFocusEffect, useRouter, Stack } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useIntl, type IntlShape } from "react-intl";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { applySwap, setItemStatus } from "@/db/items";
import { resolveShoppingItem } from "@/db/meal-ingredients";
import type { List } from "@/db/schema";
import { MEALS_WITH_SHOPPING, type ShoppingMeal } from "@/db/shopping-meals";
import { useIngredientArt } from "@/features/ingredients/ingredient-art";
import {
  alternativesForItem,
  orderedAlternatives,
} from "@/features/shop/alternatives";
import {
  type HeldPosition,
  holdPositions,
} from "@/features/shop/held-positions";
import {
  type Browse,
  ShopItemTile,
  type ShopRow,
} from "@/features/shop/shop-item-tile";
import { SwapSession } from "@/features/shop/swap-session";
import { formatCategory } from "@/features/shop/category-labels";
import { useActiveList } from "@/features/onboarding/access";
import { useToday } from "@/hooks/use-today";

const HIGHLIGHT_MS = 4500;
// Android's toolbar takes drawables, not SF Symbols. Tinted by the toolbar's
// tint colour (see `iconRenderingMode` below), so they follow light and dark.
const ADD_ICON = require("../../../../assets/icons/add.xml");
const MEALS_ICON = require("../../../../assets/icons/restaurant.xml");
const EMPTY_SHOP_ICON = require("../../../../assets/images/spot/empty-shop.webp");
type Held = Browse & { hold: HeldPosition };
type Entry = { key: string } & (
  | { kind: "header"; title: string }
  | { kind: "item"; item: ShopRow; browse: Browse | undefined; name: string }
);

export default function Shop() {
  const intl = useIntl();
  const router = useRouter();
  const list = useActiveList();
  const today = useToday();
  const { data: meals } = useQuery<ShoppingMeal>(
    `${MEALS_WITH_SHOPPING} WHERE pm.list_id = ? AND pm.slot_date >= ?`,
    [list?.id ?? "", today],
  );
  const mealsToReview = meals.filter((meal) => !meal.shopping_reviewed).length;

  // The app only opens once a household is active; this covers the rebind.
  if (!list) return <View className="flex-1 bg-background" />;
  return (
    <>
      <ListScreen key={list.id} list={list} mealsToReview={mealsToReview} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          hidden={mealsToReview === 0}
          // Android draws neither SF Symbols nor labels in a toolbar, so the
          // count rides along as a Material badge instead of "(3)" in a label.
          icon={Platform.OS === "ios" ? undefined : MEALS_ICON}
          iconRenderingMode="template"
          accessibilityLabel={intl.formatMessage(
            {
              defaultMessage:
                "{count, plural, one {1 meal to review} other {# meals to review}}",
              description:
                "Accessibility label for the Shop toolbar button that opens the meals needing a shopping decision. {count} is how many meals.",
            },
            { count: mealsToReview },
          )}
          onPress={() => router.push("/shop/meals")}
        >
          {Platform.OS === "ios" ? (
            intl.formatMessage(
              {
                defaultMessage: "Meals ({count})",
                description:
                  "Title of the Shop toolbar button that opens the meals needing a shopping decision. {count} is how many meals.",
              },
              { count: mealsToReview },
            )
          ) : (
            <Stack.Toolbar.Badge>{`${mealsToReview}`}</Stack.Toolbar.Badge>
          )}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button
          icon={Platform.OS === "ios" ? "plus" : ADD_ICON}
          iconRenderingMode="template"
          accessibilityLabel={intl.formatMessage({
            defaultMessage: "Add item",
            description:
              "Accessibility label for the Shop toolbar button that opens the item entry sheet.",
          })}
          onPress={() =>
            router.push({ pathname: "/shop/add", params: { listId: list.id } })
          }
        >
          {intl.formatMessage({
            defaultMessage: "Add",
            description:
              "Title of the Shop toolbar button that opens the item entry sheet.",
          })}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}

function buyProgress(intl: IntlShape, toBuy: number, checked: number) {
  const remaining = intl.formatMessage(
    {
      defaultMessage: "{count, plural, one {1 to buy} other {# to buy}}",
      description:
        "Summary above the shopping list. {count} is how many items are still to buy.",
    },
    { count: toBuy },
  );
  if (!checked) return remaining;
  const checkedLabel = intl.formatMessage(
    {
      defaultMessage: "{count} checked",
      description:
        "How many shopping items were already checked off, after the count still to buy.",
    },
    { count: checked },
  );
  return [remaining, checkedLabel].join(" · ");
}

function ListScreen({
  list,
  mealsToReview,
}: {
  list: List;
  mealsToReview: number;
}) {
  const intl = useIntl();
  const router = useRouter();
  const today = useToday();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const tileWidth = width < 320 || fontScale >= 1.5 ? "100%" : "50%";
  // Sessions are imperative and never read during render; `browsing` holds
  // what the tiles need to show for each one.
  const sessions = useRef(new Map<string, SwapSession>());
  const [browsing, setBrowsing] = useState(new Map<string, Held>());
  const [highlighted, setHighlighted] = useState<string | null>(null);
  // The tile whose sheet is open stays lit, so the sheet reads as its detail.
  const [selected, setSelected] = useState<string | null>(null);
  useFocusEffect(useCallback(() => setSelected(null), []));
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const activeSessions = sessions.current;
    return () => {
      activeSessions.forEach((session) => session.dispose());
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  // Stable callback: useFocusEffect reruns, cleanup included, whenever the
  // callback changes, and this cleanup sets state.
  useFocusEffect(
    useCallback(() => {
      // Resorting happens on revisit: holds live until the screen loses focus.
      return () => {
        sessions.current.forEach((session) => session.dispose());
        sessions.current.clear();
        setBrowsing(new Map());
        setHighlighted(null);
        if (highlightTimer.current) clearTimeout(highlightTimer.current);
      };
    }, []),
  );

  const { data: rawRows } = useQuery<ShopRow>(
    `SELECT i.*, c.name AS category_name, v.ingredient_lines, pm.ingredient_swaps,
            pm.slot_date AS slot_date, pm.meal AS meal
       FROM list_items i
       LEFT JOIN categories c ON c.id = i.category_id
       LEFT JOIN planned_meals pm ON pm.id = i.planned_meal_id
       LEFT JOIN variants v ON v.id = pm.variant_id
      WHERE i.list_id = ?
      ORDER BY i.status,
               CASE WHEN i.status = 'purchased' THEN i.updated_at END DESC,
               COALESCE(c.sort_order, 999), COALESCE(c.name, 'zzz'), i.name, i.id`,
    [list.id],
  );
  const { data: categories } = useQuery<{
    id: string;
    name: string;
    sort_order: number;
  }>("SELECT id, name, sort_order FROM categories");
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const rows = rawRows.map((row) => {
    const resolved = resolveShoppingItem(row);
    return {
      ...resolved,
      category_name: categoryById.get(resolved.category_id ?? "")?.name ?? null,
    };
  });
  // Resolve category and name before sorting outstanding ingredients. Purchases
  // keep the SQL query's check-off order and their captured details.
  const outstanding = rows
    .filter((item) => item.status === "active")
    .sort(
      (a, b) =>
        (categoryById.get(a.category_id ?? "")?.sort_order ?? 999) -
          (categoryById.get(b.category_id ?? "")?.sort_order ?? 999) ||
        (a.name ?? "").localeCompare(b.name ?? "") ||
        a.id.localeCompare(b.id),
    );
  const active = holdPositions(
    outstanding,
    [...browsing.values()].map((held) => held.hold),
  );
  const checked = rows
    .filter((item) => item.status === "purchased")
    .slice(0, 50);

  function clearHighlightLater() {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(
      () => setHighlighted(null),
      HIGHLIGHT_MS,
    );
  }

  function releasePosition(itemId: string) {
    sessions.current.delete(itemId);
    setBrowsing((current) => {
      const next = new Map(current);
      next.delete(itemId);
      return next;
    });
    clearHighlightLater();
  }

  function check(id: string) {
    const purchase = () => setItemStatus(id, "purchased");
    return sessions.current.get(id)?.check(purchase) ?? purchase();
  }

  function open(id: string) {
    setSelected(id);
    router.push({ pathname: "/shop/item", params: { itemId: id } });
  }

  function swap(item: ShopRow) {
    if (item.ingredient_id == null || item.status === "purchased") return;
    let session = sessions.current.get(item.id);
    if (!session) {
      const options = orderedAlternatives(
        item.name ?? "",
        alternativesForItem(
          item.name ?? "",
          item.ingredient_lines,
          item.ingredient_id,
        ),
      );
      if (options.length < 2) return;
      const hold: HeldPosition = {
        itemId: item.id,
        index: active.findIndex((row) => row.id === item.id),
        categoryId: item.category_id,
        categoryName: item.category_name,
      };
      setBrowsing((current) =>
        new Map(current).set(item.id, {
          options,
          selected: options[0]!,
          hold,
        }),
      );
      session = new SwapSession(options, {
        save: (option) => applySwap(item.id, option.name),
        change: (option) =>
          setBrowsing((current) => {
            const held = current.get(item.id);
            if (!held) return current;
            return new Map(current).set(item.id, { ...held, selected: option });
          }),
        release: () => releasePosition(item.id),
        error: () => {
          setHighlighted(null);
          Alert.alert(
            intl.formatMessage({
              defaultMessage: "Couldn’t swap item",
              description:
                "Alert title when swapping a shopping item for another option failed.",
            }),
            intl.formatMessage({
              defaultMessage: "Please try again.",
              description:
                "Generic alert body after an action failed. The user can repeat it.",
            }),
          );
        },
      });
      sessions.current.set(item.id, session);
    }
    const index = session.options.indexOf(session.selected);
    const alternative = session.options[index + 1] ?? session.options[0]!;
    setHighlighted(item.id);
    clearHighlightLater();
    session.select(alternative);
    AccessibilityInfo.announceForAccessibility(
      intl.formatMessage(
        {
          defaultMessage: "Changed to {name}",
          description:
            "Screen-reader announcement after a shopping item switched to another ingredient option. {name} is the option now shown.",
        },
        { name: alternative.name },
      ),
    );
  }

  // Headers span the grid, but all tiles share one parent. Keeping their keys
  // across categories and check-off preserves pending feedback until sync.
  const entries: Entry[] = [];
  function addTile(item: ShopRow) {
    const browse = browsing.get(item.id);
    entries.push({
      key: item.id,
      kind: "item",
      item,
      browse,
      name: browse?.selected.name ?? item.name ?? "",
    });
  }
  let category: string | null | undefined;
  for (const item of active) {
    if (item.category_id !== category) {
      category = item.category_id;
      entries.push({
        key: `category:${category}`,
        kind: "header",
        title:
          formatCategory(intl, item.category_id, item.category_name) ??
          intl.formatMessage({
            defaultMessage: "Uncategorised",
            description:
              "Fallback for a shopping item whose category is missing. Also the menu option that clears the category.",
          }),
      });
    }
    addTile(item);
  }
  if (checked.length) {
    entries.push({
      key: "checked",
      kind: "header",
      title: intl.formatMessage({
        defaultMessage: "Checked",
        description:
          "Heading above the shopping items that were already checked off.",
      }),
    });
    for (const item of checked) addTile(item);
  }
  // Batch just the names the grid displays, including any unsaved swap.
  const artFor = useIngredientArt(
    entries.flatMap((entry) => (entry.kind === "item" ? [entry.name] : [])),
  );

  // Large title collapses only when the ScrollView is the first native
  // child of the screen (expo-router Stack docs). No wrapper View.
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      removeClippedSubviews={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {entries.length === 0 ? (
        <View className="items-center gap-4 px-6 py-16">
          <Image
            source={EMPTY_SHOP_ICON}
            contentFit="contain"
            style={{ width: 140, height: 140 }}
            accessibilityLabel={intl.formatMessage({
              defaultMessage: "Empty shopping list",
              description:
                "Accessibility label for the illustration shown when the shopping list has no items.",
            })}
          />
          <Text variant="muted" className="text-center">
            {active.length === 0
              ? mealsToReview > 0
                ? intl.formatMessage({
                    defaultMessage:
                      "Nothing to buy yet. Open Meals to choose what to buy, or add an item.",
                    description:
                      "Empty Shop state when planned meals still need a shopping choice. Names two ways to get items on the list.",
                  })
                : intl.formatMessage({
                    defaultMessage:
                      "Nothing to buy. Plan a meal to choose what to buy for it, or add an item.",
                    description:
                      "Empty Shop state when no meal is waiting for a shopping choice. Names the two ways to get items on the list.",
                  })
              : buyProgress(intl, active.length, checked.length)}
          </Text>
        </View>
      ) : (
        <Text variant="muted" className="px-4 pb-1 android:pt-3">
          {buyProgress(intl, active.length, checked.length)}
        </Text>
      )}
      <View className="flex-row flex-wrap gap-y-2 px-3">
        {entries.map((entry) => {
          if (entry.kind === "header") {
            return (
              <Text
                key={entry.key}
                accessibilityRole="header"
                className="w-full px-1 pb-0.5 pt-4 font-rounded text-base font-extrabold text-primary"
              >
                {entry.title}
              </Text>
            );
          }
          return (
            <View key={entry.key} className="px-1" style={{ width: tileWidth }}>
              <ShopItemTile
                item={entry.item}
                today={today}
                browse={entry.browse}
                name={entry.name}
                asset={artFor(entry.name)}
                highlighted={
                  highlighted === entry.item.id || selected === entry.item.id
                }
                onCheck={check}
                onSwap={swap}
                onOpen={open}
              />
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
