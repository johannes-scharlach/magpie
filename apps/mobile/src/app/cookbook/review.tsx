import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";

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
        action === "adding" ? "Could not add the recipes" : "Could not discard",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title:
            recipes.length === 1
              ? "Found 1 recipe"
              : `Found ${recipes.length} recipes`,
        }}
      />
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-6 px-6 pt-4 pb-6"
      >
        <Text variant="muted">
          Ticked recipes go to your cookbook. Nothing is saved until you add
          them.
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
            <Text className="font-rounded text-lg font-bold">Incomplete</Text>
            <Text variant="muted">
              To add one of these, import all its pages together.
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
                ? "Adding…"
                : keep.length === 1
                  ? "Add 1 recipe"
                  : `Add ${keep.length} recipes`
            }
            onPress={() =>
              void finish("adding", () => confirmImport(operationId, keep))
            }
            disabled={keep.length === 0 || busy !== null}
          />
          <Action
            label={busy === "discarding" ? "Discarding…" : "Discard all"}
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
