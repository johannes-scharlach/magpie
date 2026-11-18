import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useShareIntent } from "expo-share-intent";
import { useEffect, useSyncExternalStore } from "react";

import { useHouseholdAccess } from "@/features/onboarding/access";
import { pastedImport, type PastedImport } from "./pasted-import";
import { sharedImportSource } from "./shared-import";
import { useImportJobs } from "./use-import-jobs";

const KEY = "magpie.pending-share-import.v1";

/** A share waiting for sign-in, onboarding or the cookbook to be shown. */
class PendingImports {
  private pending: PastedImport | null = null;
  /** A share was already started this session; the one on disk is its copy. */
  private drained = false;
  private readonly listeners = new Set<() => void>();

  readonly getSnapshot = (): PastedImport | null => this.pending;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  receive(source: PastedImport): void {
    this.pending = source;
    this.drained = false;
    this.emit();
  }

  /** A share that just arrived is newer than one kept on disk. */
  receiveIfEmpty(source: PastedImport): void {
    if (!this.pending && !this.drained) this.receive(source);
  }

  take(): PastedImport | null {
    const source = this.pending;
    if (!source) return null;
    this.pending = null;
    this.drained = true;
    this.emit();
    return source;
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}
const pendingImports = new PendingImports();

/**
 * A link or text shared to Magpie imports into the active household's
 * cookbook. Sharing is already the cook's choice, so the import starts once
 * the cookbook can show it. A share that arrives before sign-in or onboarding
 * waits on the device (ADR 41).
 */
export function IncomingShare({ showApp }: { showApp: boolean }) {
  const router = useRouter();
  const { listId } = useHouseholdAccess();
  const importJobs = useImportJobs();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const pending = useSyncExternalStore(
    pendingImports.subscribe,
    pendingImports.getSnapshot,
  );

  // The native intent is only a handoff: keep its content ourselves before
  // the app can be sent to the background, where the extension's data clears.
  useEffect(() => {
    if (!hasShareIntent) return;
    const source = sharedImportSource(shareIntent);
    resetShareIntent();
    if (!source) return;
    pendingImports.receive(source);
    void AsyncStorage.setItem(
      KEY,
      source.kind === "link" ? source.url : source.text,
    ).catch(() => {});
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  // A share from before the app could import it, such as one opened on the
  // sign-in screen or before a process restart.
  useEffect(() => {
    void AsyncStorage.getItem(KEY)
      .then((stored) => {
        const source = pastedImport(stored ?? "");
        if (source) pendingImports.receiveIfEmpty(source);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showApp || !listId || !pending) return;
    // Claim it before it can be started a second time by another launch.
    const source = pendingImports.take();
    if (!source) return;
    void AsyncStorage.removeItem(KEY).catch(() => {});
    if (router.canDismiss()) router.dismissAll();
    router.navigate("/(tabs)/cookbook");
    void importJobs.start(listId, source);
  }, [showApp, listId, pending, router, importJobs]);

  return null;
}
