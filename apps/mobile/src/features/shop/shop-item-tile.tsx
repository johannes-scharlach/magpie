import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { defineMessages, useIntl } from "react-intl";
import { useResolveClassNames } from "uniwind";

import { CHECKED_ICON, UNCHECKED_ICON } from "@/components/check-icons";
import { ClayPebble, PressableScale, clayTile } from "@/components/clay";
import { Text } from "@/components/ui/text";
import { setItemStatus } from "@/db/items";
import type { ListItem } from "@/db/schema";
import { formatPlannedWhen } from "@/features/meals/labels";
import { tonalPair } from "@/features/variants/tonal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { cn } from "@/lib/utils";

import {
  alternativesForItem,
  orderedAlternatives,
  type Alternative,
} from "./alternatives";
import { CheckOff } from "./check-off";
import { mealAge } from "./meal-age";
import { shopMessages } from "./messages";
import { splitSpec } from "./spec";
import { capitalize } from "./text";

const checkBoxMessages = defineMessages<{
  restore: { name: string };
  checkOff: { name: string };
}>(
  {
    restore: {
      defaultMessage: "Restore {name}",
      description:
        "Accessibility label for the checkbox of a bought shopping item. Selecting it puts the item back on the list. {name} is the item's name.",
    },
    checkOff: {
      defaultMessage: "Check off {name}",
      description:
        "Accessibility label for the checkbox of a shopping item. Selecting it marks the item as bought. {name} is the item's name.",
    },
  },
  { typed: true },
);

const CHECK_DELAY_MS = 380;

export type ShopRow = ListItem & {
  category_name: string | null;
  ingredient_lines: string | null;
  ingredient_swaps: string | null;
  slot_date: string | null;
  meal: string | null;
};
export type Browse = { options: Alternative[]; selected: Alternative };

export function ShopItemTile({
  item,
  today,
  browse,
  name,
  asset,
  highlighted,
  onCheck,
  onSwap,
  onOpen,
}: {
  item: ShopRow;
  today: string;
  browse: Browse | undefined;
  name: string;
  asset: number | string | undefined;
  highlighted: boolean;
  onCheck: (id: string) => Promise<void>;
  onSwap: (item: ShopRow) => void;
  onOpen: (id: string) => void;
}) {
  const intl = useIntl();
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const primaryColor = useResolveClassNames("text-primary").color;
  const dark = useColorScheme() === "dark";
  const purchased = item.status === "purchased";
  const { pending, check } = useCheckOff(purchased, () => onCheck(item.id));
  const checked = purchased || pending;
  const spec = browse
    ? [browse.selected.qtyText, browse.selected.prepNote]
        .filter(Boolean)
        .join(", ")
    : item.spec;
  // Recipe prep stays in details when there is an amount. Standalone notes
  // belong to the user and are always displayed as written.
  const quantity = item.planned_meal_id
    ? (splitSpec(spec).amount ?? spec)
    : spec;
  const when = formatPlannedWhen(intl, item.slot_date, item.meal);
  const age = purchased ? null : mealAge(intl, item.slot_date, today);
  const mealContext =
    item.planned_meal_id && when
      ? [when, age].filter(Boolean).join(" · ")
      : null;

  const options =
    purchased || item.ingredient_id == null
      ? []
      : (browse?.options ??
        orderedAlternatives(
          item.name ?? "",
          alternativesForItem(
            item.name ?? "",
            item.ingredient_lines,
            item.ingredient_id,
          ),
        ));
  const optionIndex = browse ? options.indexOf(browse.selected) : 0;
  const quickSwap =
    options.length > 1 ? (options[optionIndex + 1] ?? options[0]) : undefined;

  function toggle() {
    if (!purchased) {
      check();
      return;
    }
    void setItemStatus(item.id, "active").catch(() =>
      Alert.alert(
        intl.formatMessage(shopMessages.restoreItem),
        intl.formatMessage(shopMessages.tryAgain),
      ),
    );
  }

  return (
    <View
      className={cn(
        "flex-1 border",
        checked || highlighted ? "bg-accent" : "bg-secondary",
        highlighted ? "border-primary" : "border-transparent",
      )}
      style={clayTile}
    >
      <PressableScale
        className="flex-1"
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={[
          intl.formatMessage(
            checked ? checkBoxMessages.restore : checkBoxMessages.checkOff,
            { name },
          ),
          quantity,
          mealContext,
        ]
          .filter(Boolean)
          .join(", ")}
        onPress={toggle}
      >
        <View className="gap-1 px-3 pb-1 pt-2">
          <View
            className="h-16 items-center justify-center"
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {asset !== undefined ? (
              <View className={cn("h-14 w-19", checked && "opacity-60")}>
                <ClayPebble seed={name} />
                <Image
                  source={asset}
                  recyclingKey={String(asset)}
                  contentFit="contain"
                  style={{
                    position: "absolute",
                    width: "110%",
                    height: "110%",
                    top: "-5%",
                    start: "-5%",
                  }}
                />
              </View>
            ) : (
              <SymbolView
                name={{ ios: "bag", android: "shopping_bag" }}
                tintColor={mutedColor}
                size={26}
              />
            )}
            <View className="absolute end-0 top-0">
              <SymbolView
                name={checked ? CHECKED_ICON : UNCHECKED_ICON}
                tintColor={checked ? primaryColor : mutedColor}
                weight="medium"
                size={22}
              />
            </View>
          </View>
          <Text
            className={cn(
              "text-center font-rounded text-base font-bold",
              checked && "text-muted-foreground line-through",
            )}
          >
            {capitalize(name)}
          </Text>
          {quantity ? (
            <Text
              className="text-center text-sm font-medium"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {quantity}
            </Text>
          ) : null}
          {item.planned_meal_id && mealContext ? (
            <View className="flex-row items-center justify-center gap-1.5">
              <View
                className="size-2 rounded-full"
                style={{
                  backgroundColor: tonalPair(
                    item.variant_id ?? item.planned_meal_id,
                    dark,
                  )[1],
                }}
              />
              <Text
                variant="muted"
                className={cn("shrink text-xs", age && "font-medium")}
              >
                {mealContext}
              </Text>
            </View>
          ) : null}
        </View>
      </PressableScale>
      <View className="flex-row justify-end px-1">
        {quickSwap ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={intl.formatMessage(
              {
                defaultMessage: "Use {name}",
                description:
                  "Accessibility action that switches a shopping item to another ingredient option. {name} is that option's name.",
              },
              { name: quickSwap.name },
            )}
            disabled={pending}
            onPress={() => onSwap(item)}
            className="size-12 items-center justify-center rounded-full active:bg-background disabled:opacity-50"
          >
            <SymbolView
              name={{ ios: "arrow.left.arrow.right", android: "swap_horiz" }}
              tintColor={mutedColor}
              size={18}
            />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[
            intl.formatMessage({
              defaultMessage: "Open details",
              description:
                "Accessibility action that opens the shopping item's detail sheet.",
            }),
            name,
          ].join(", ")}
          disabled={pending}
          onPress={() => onOpen(item.id)}
          className="size-12 items-center justify-center rounded-full active:bg-background disabled:opacity-50"
        >
          <SymbolView
            name={{ ios: "info.circle", android: "info" }}
            tintColor={mutedColor}
            size={18}
          />
        </Pressable>
      </View>
    </View>
  );
}

function useCheckOff(purchased: boolean, commit: () => Promise<void>) {
  const intl = useIntl();
  const [pending, setPending] = useState(false);
  const [checkOff] = useState(
    () =>
      new CheckOff(CHECK_DELAY_MS, {
        change: setPending,
        error: () =>
          Alert.alert(
            intl.formatMessage(shopMessages.checkOffItem),
            intl.formatMessage(shopMessages.tryAgain),
          ),
      }),
  );
  useEffect(() => () => checkOff.dispose(), [checkOff]);
  useEffect(() => checkOff.settle(!purchased), [checkOff, purchased]);
  return {
    pending,
    check: () => {
      checkOff.press(commit);
      checkOff.release(true);
    },
  };
}
