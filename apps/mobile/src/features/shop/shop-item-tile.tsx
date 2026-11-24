import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { defineMessages, useIntl } from "react-intl";
import { useResolveClassNames } from "uniwind";

import { CHECKED_ICON, UNCHECKED_ICON } from "@/components/check-icons";
import { PressableScale } from "@/components/clay";
import { Text } from "@/components/ui/text";
import { setItemStatus } from "@/db/items";
import type { ListItem } from "@/db/schema";
import { cn } from "@/lib/utils";

import { CheckOff } from "./check-off";
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
};

export function ShopItemTile({
  item,
  asset,
  highlighted,
  onOpen,
}: {
  item: ShopRow;
  asset: number | string | undefined;
  highlighted: boolean;
  onOpen: (id: string) => void;
}) {
  const intl = useIntl();
  const mutedColor = useResolveClassNames("text-muted-foreground").color;
  const primaryColor = useResolveClassNames("text-primary").color;
  const name = item.name ?? "";
  const purchased = item.status === "purchased";
  const { pending, check } = useCheckOff(purchased, () =>
    setItemStatus(item.id, "purchased"),
  );
  const checked = purchased || pending;
  // Recipe prep stays in details when there is an amount. Standalone notes
  // belong to the user and are always displayed as written.
  const quantity = item.planned_meal_id
    ? (splitSpec(item.spec).amount ?? item.spec)
    : item.spec;

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
        "flex-row items-center border-b border-border/60",
        highlighted && "bg-muted",
      )}
    >
      <PressableScale
        className="min-h-14 flex-1 justify-center self-stretch"
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={[
          intl.formatMessage(
            checked ? checkBoxMessages.restore : checkBoxMessages.checkOff,
            { name },
          ),
          quantity,
        ]
          .filter(Boolean)
          .join(", ")}
        onPress={toggle}
      >
        <View className="flex-row items-center gap-3 py-1.5">
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <SymbolView
              name={checked ? CHECKED_ICON : UNCHECKED_ICON}
              tintColor={checked ? primaryColor : mutedColor}
              weight="medium"
              size={22}
            />
          </View>
          <View className="flex-1">
            <Text
              className={cn(
                "font-rounded text-base font-bold",
                checked && "text-muted-foreground line-through",
              )}
            >
              {capitalize(name)}
            </Text>
            {quantity ? (
              <Text
                className="text-sm font-medium text-muted-foreground"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {quantity}
              </Text>
            ) : null}
          </View>
          {asset !== undefined ? (
            <View
              className={cn("h-12 w-16", checked && "opacity-60")}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Image
                source={asset}
                recyclingKey={String(asset)}
                contentFit="contain"
                style={{ position: "absolute", width: "100%", height: "100%" }}
              />
            </View>
          ) : null}
        </View>
      </PressableScale>
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
        className="size-11 items-center justify-center rounded-full active:bg-muted disabled:opacity-50"
      >
        <SymbolView
          name={{ ios: "chevron.right", android: "chevron_right" }}
          tintColor={mutedColor}
          size={14}
        />
      </Pressable>
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
