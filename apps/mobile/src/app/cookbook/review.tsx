import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useIntl } from "react-intl";

import { Action, PrimaryAction } from "@/components/action";
import { ChoiceList } from "@/components/choice-list";
import { SheetActions } from "@/components/sheet-actions";
import { Text } from "@/components/ui/text";
import { useImportReviews } from "@/db/import-reviews";
import { cancelImport, confirmImport } from "@/features/meals/import-adapters";

/** An import found more than one recipe, or part of one (ADR 35). Every
 *  complete recipe starts ticked; the incomplete ones say what is missing and
 *  cannot be kept. Nothing is saved until the cook confirms. */
export default function ReviewImport() {
  const intl = useIntl();
  const router = useRouter();
  const { operationId } = useLocalSearchParams<{ operationId: string }>();
  const review = useImportReviews().find(
    (candidate) => candidate.operationId === operationId,
  );
  const [dropped, setDropped] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState<"adding" | "discarding" | null>(null);
  if (!review) return null;

  const { recipes, skipped } = review;
  const keep = recipes.map((_, i) => i).filter((i) => !dropped.has(i));

  function toggle(index: number) {
    setDropped((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  }

  /** The review leaves this phone through sync, with the saved recipes. */
  async function finish(
    action: "adding" | "discarding",
    run: () => Promise<unknown>,
  ) {
    setBusy(action);
    try {
      await run();
      router.back();
    } catch (error) {
      setBusy(null);
      Alert.alert(
        action === "adding"
          ? intl.formatMessage({
              defaultMessage: "Could not add the recipes",
              description:
                "Alert title when keeping the reviewed recipes failed. The imported text is still there.",
            })
          : intl.formatMessage({
              defaultMessage: "Could not discard",
              description:
                "Alert title when discarding a reviewed import failed.",
            }),
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: intl.formatMessage(
            {
              defaultMessage:
                "{count, plural, one {Found 1 recipe} other {Found # recipes}}",
              description:
                "Title of the sheet reviewing what an import found. {count} is how many recipes it read.",
            },
            { count: recipes.length },
          ),
        }}
      />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-6 px-6 pt-4 pb-6"
      >
        <Text variant="muted">
          {intl.formatMessage({
            defaultMessage:
              "Ticked recipes go to your cookbook. Nothing is saved until you add them.",
            description:
              "Instruction above the list of recipes an import found. Each complete recipe starts ticked.",
          })}
        </Text>
        {recipes.length ? (
          <ChoiceList
            choices={recipes.map(({ name, sourceReference }, i) => ({
              key: String(i),
              title: name,
              detail: sourceReference ?? undefined,
            }))}
            selectedKeys={keep.map(String)}
            onSelect={(key) => toggle(Number(key))}
          />
        ) : null}
        {skipped.length ? (
          <View className="gap-3">
            <Text className="font-rounded text-lg font-bold">
              {intl.formatMessage({
                defaultMessage: "Incomplete",
                description:
                  "Heading above recipes an import could not read completely. They cannot be kept.",
              })}
            </Text>
            <Text variant="muted">
              {intl.formatMessage({
                defaultMessage:
                  "To add one of these, import all its pages together.",
                description:
                  "Explains how to recover an incomplete recipe: import the rest of its pages in the same import.",
              })}
            </Text>
            {skipped.map(({ name, sourceReference, reason }, i) => (
              <View key={i} className="gap-0.5">
                <Text className="font-medium">{name}</Text>
                {sourceReference ? (
                  <Text variant="muted" className="text-sm">
                    {sourceReference}
                  </Text>
                ) : null}
                <Text variant="muted" className="text-sm">
                  {reason}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <SheetActions>
          <PrimaryAction
            label={
              busy === "adding"
                ? intl.formatMessage({
                    defaultMessage: "Adding…",
                    description:
                      "Status while the ticked recipes are being saved.",
                  })
                : intl.formatMessage(
                    {
                      defaultMessage:
                        "{count, plural, one {Add 1 recipe} other {Add # recipes}}",
                      description:
                        "Action that saves the ticked recipes to the cookbook. {count} is how many are ticked.",
                    },
                    { count: keep.length },
                  )
            }
            onPress={() =>
              void finish("adding", () => confirmImport(operationId, keep))
            }
            disabled={keep.length === 0 || busy !== null}
          />
          <Action
            label={
              busy === "discarding"
                ? intl.formatMessage({
                    defaultMessage: "Discarding…",
                    description: "Status while a reviewed import is discarded.",
                  })
                : intl.formatMessage({
                    defaultMessage: "Discard all",
                    description:
                      "Destructive action that throws away everything an import found.",
                  })
            }
            onPress={() =>
              void finish("discarding", () => cancelImport(operationId))
            }
            disabled={busy !== null}
            destructive
          />
        </SheetActions>
      </ScrollView>
    </>
  );
}
