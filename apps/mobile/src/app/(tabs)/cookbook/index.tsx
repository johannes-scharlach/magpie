import { Stack, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, View } from "react-native";
import { useResolveClassNames } from "uniwind";

import { useImportReviews } from "@/db/import-reviews";
import { RecipeBrowser } from "@/features/cookbook/recipe-browser";
import {
  ImportJobStatus,
  ImportReviewRow,
} from "@/features/meals/import-job-status";
import { useImportJobs } from "@/features/meals/use-import-jobs";
import { useHouseholdAccess } from "@/features/onboarding/access";

export default function Cookbook() {
  const color = useResolveClassNames("text-foreground").color;
  const importJobs = useImportJobs();
  const { listId } = useHouseholdAccess();
  const imports = listId ? importJobs.getForCookbook(listId) : [];
  const reviews = useImportReviews().filter(
    (review) => review.listId === listId,
  );
  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/cookbook/import")}
              hitSlop={12}
              accessibilityLabel="Import recipe"
              accessibilityRole="button"
              className="p-2"
            >
              <SymbolView
                name={{ ios: "plus", android: "add" }}
                tintColor={color}
                size={22}
              />
            </Pressable>
          ),
        }}
      />
      <RecipeBrowser
        header={[
          ...reviews.map((review) => (
            <View
              key={review.operationId}
              className="border-b border-border/40 px-6 py-3"
              accessibilityLiveRegion="polite"
            >
              <ImportReviewRow review={review} />
            </View>
          )),
          ...imports.map((job) => (
            <View
              key={job.request.operationId}
              className="border-b border-border/40 px-6 py-3"
              accessibilityLiveRegion="polite"
            >
              <ImportJobStatus job={job} importJobs={importJobs} />
            </View>
          )),
        ]}
        onImport={() => router.push("/cookbook/import")}
      />
    </>
  );
}
