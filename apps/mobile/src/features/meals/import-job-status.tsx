import { router } from "expo-router";
import { type IntlShape, useIntl } from "react-intl";
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
  const intl = useIntl();
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
            <Text>
              {intl.formatMessage({
                defaultMessage: "Retry",
                description: "Action that retries a failed recipe import.",
              })}
            </Text>
          </Button>
        ) : null}
        <Button variant="ghost" onPress={() => importJobs.dismiss(operationId)}>
          <Text>
            {intl.formatMessage({
              defaultMessage: "Dismiss",
              description: "Action that hides a failed recipe import.",
            })}
          </Text>
        </Button>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-3">
      <ActivityIndicator />
      <Text numberOfLines={1} className="flex-1">
        {job.status === "cancelling"
          ? intl.formatMessage({
              defaultMessage: "Cancelling…",
              description: "Status while a recipe import is being cancelled.",
            })
          : job.status === "syncing" && !("review" in job.result)
            ? job.request.plan
              ? intl.formatMessage({
                  defaultMessage: "Adding to your plan…",
                  description:
                    "Status while an imported recipe is being added to the meal plan.",
                })
              : intl.formatMessage({
                  defaultMessage: "Adding to your cookbook…",
                  description:
                    "Status while an imported recipe is being added to the cookbook.",
                })
            : readingLabel(job.request.source, intl)}
      </Text>
      {job.status === "importing" ? (
        <Button
          variant="ghost"
          size="sm"
          onPress={() =>
            void importJobs.cancel(operationId).catch((error: unknown) =>
              Alert.alert(
                intl.formatMessage({
                  defaultMessage: "Could not cancel",
                  description:
                    "Alert title when cancelling a recipe import failed.",
                }),
                error instanceof Error ? error.message : String(error),
              ),
            )
          }
        >
          <Text>
            {intl.formatMessage({
              defaultMessage: "Cancel",
              description: "Action that cancels a running recipe import.",
            })}
          </Text>
        </Button>
      ) : null}
    </View>
  );
}

/** An import waiting for the cook to choose its recipes (ADR 35). */
export function ImportReviewRow({ review }: { review: ImportReview }) {
  const intl = useIntl();
  const { operationId, recipes, skipped } = review;
  return (
    <View className="flex-row items-center gap-3">
      <Text numberOfLines={1} className="flex-1">
        {intl.formatMessage(
          {
            defaultMessage:
              "{incomplete, plural, =0 {{count, plural, one {Found # recipe} other {Found # recipes}}} other {{count, plural, one {# complete recipe} other {# complete recipes}}, {incomplete, number} incomplete}}",
            description:
              "Status on the import review row. The count is complete recipes the cook can keep. Incomplete counts recipes with missing material, not pages. These recipes cannot be kept. Keep this summary short.",
          },
          { count: recipes.length, incomplete: skipped.length },
        )}
      </Text>
      <Button
        size="sm"
        onPress={() =>
          router.push({ pathname: "/cookbook/review", params: { operationId } })
        }
      >
        <Text>
          {intl.formatMessage({
            defaultMessage: "Review",
            description: "Action that opens imported recipes for review.",
          })}
        </Text>
      </Button>
    </View>
  );
}

export function readingLabel(source: ImportSource, intl: IntlShape): string {
  if (source.kind === "link") {
    return intl.formatMessage(
      {
        defaultMessage: "Reading {host}…",
        description:
          "Status while a recipe is being read from a website, with its hostname.",
      },
      { host: new URL(source.url).hostname.replace(/^www\./, "") },
    );
  }
  if (source.kind === "text") {
    return intl.formatMessage(
      {
        defaultMessage: "Reading “{text}”…",
        description:
          "Status while a recipe is being read from pasted text, with its first line.",
      },
      { text: source.text.split("\n")[0] },
    );
  }
  return intl.formatMessage(
    {
      defaultMessage:
        "{count, plural, one {Reading your photo…} other {Reading # photos…}}",
      description:
        "Status while recipe photos are being read, with the number of photos.",
    },
    { count: source.photos.length },
  );
}
