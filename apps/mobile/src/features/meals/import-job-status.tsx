import { router } from "expo-router";
import { ActivityIndicator, Alert, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { ImportReview } from "@/db/import-reviews";
import type { ImportJob, ImportJobs, ImportSource } from "./import-jobs";

/** Progress of one import where its recipe will land, with Cancel while it
 *  reads and Retry or Dismiss once it failed. */
export function ImportJobStatus({
  job,
  importJobs,
}: {
  job: ImportJob;
  importJobs: ImportJobs;
}) {
  const { operationId } = job.request;
  if (job.status === "error") {
    return (
      <View className="gap-3">
        <Text className="text-destructive">{job.error.message}</Text>
        {job.error.retryable ? (
          <Button
            variant="outline"
            onPress={() => void importJobs.retry(operationId)}
          >
            <Text>Retry</Text>
          </Button>
        ) : null}
        <Button variant="ghost" onPress={() => importJobs.dismiss(operationId)}>
          <Text>Dismiss</Text>
        </Button>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-3">
      <ActivityIndicator />
      <Text numberOfLines={1} className="flex-1">
        {job.status === "cancelling"
          ? "Cancelling…"
          : job.status === "syncing" && !("review" in job.result)
            ? job.request.plan
              ? "Adding to your plan…"
              : "Adding to your cookbook…"
            : readingLabel(job.request.source)}
      </Text>
      {job.status === "importing" ? (
        <Button
          variant="ghost"
          size="sm"
          onPress={() =>
            void importJobs
              .cancel(operationId)
              .catch((error: unknown) =>
                Alert.alert(
                  "Could not cancel",
                  error instanceof Error ? error.message : String(error),
                ),
              )
          }
        >
          <Text>Cancel</Text>
        </Button>
      ) : null}
    </View>
  );
}

/** An import waiting for the cook to choose its recipes (ADR 35). */
export function ImportReviewRow({ review }: { review: ImportReview }) {
  const { operationId, recipes, skipped } = review;
  const found =
    recipes.length === 1 ? "Found 1 recipe" : `Found ${recipes.length} recipes`;
  return (
    <View className="flex-row items-center gap-3">
      <Text numberOfLines={1} className="flex-1">
        {skipped.length ? `${found}, ${skipped.length} incomplete` : found}
      </Text>
      <Button
        size="sm"
        onPress={() =>
          router.push({ pathname: "/cookbook/review", params: { operationId } })
        }
      >
        <Text>Review</Text>
      </Button>
    </View>
  );
}

export function readingLabel(source: ImportSource): string {
  if (source.kind === "link") {
    return `Reading ${new URL(source.url).hostname.replace(/^www\./, "")}…`;
  }
  if (source.kind === "text") {
    return `Reading “${source.text.split("\n")[0]}”…`;
  }
  return source.photos.length === 1
    ? "Reading your photo…"
    : `Reading ${source.photos.length} photos…`;
}
