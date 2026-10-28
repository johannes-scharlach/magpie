import { useSyncExternalStore } from "react";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { AppState } from "react-native";

import { posthog } from "@/lib/posthog";
import { ImportJobs } from "./import-jobs";
import { cancelImport, sendImport, waitForSync } from "./import-adapters";

// App lifetime, independent of a particular sheet or tab mount.
const importJobs = new ImportJobs({
  createOperationId: Crypto.randomUUID,
  send: sendImport,
  waitForSync,
  cancel: cancelImport,
  whenActive: () =>
    new Promise((resolve) => {
      if (AppState.currentState === "active") return resolve();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state !== "active") return;
        subscription.remove();
        resolve();
      });
    }),
  onCompleted: (request) => {
    posthog?.capture("recipe_imported", {
      source: request.source.kind,
      target: request.plan ? "plan" : "cookbook",
    });
    if (AppState.currentState === "active") {
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }
  },
});

export function useImportJobs(): ImportJobs {
  useSyncExternalStore(importJobs.subscribe, importJobs.getSnapshot);
  return importJobs;
}
