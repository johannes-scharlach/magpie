import { describe, expect, it, vi } from "vitest";

import {
  ImportJobs,
  type CancelOutcome,
  type ImportOutcome,
  type ImportResult,
  type ImportReview,
} from "./import-jobs";
import { ImportFailure } from "./import-failure";

const target = { listId: "list", date: "2026-09-08", slot: "dinner" } as const;
const plan = { date: target.date, slot: target.slot };
const link = { kind: "link", url: "https://recipe.example" } as const;
const result = { recipeId: "recipe", variantId: "variant" };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup() {
  let id = 0;
  const dependencies = {
    createOperationId: vi.fn(() => `operation-${++id}`),
    send: vi.fn(async (): Promise<ImportOutcome> => result),
    waitForSync: vi.fn(async () => {}),
    cancel: vi.fn(async (): Promise<CancelOutcome> => ({
      outcome: "cancelled",
    })),
    whenActive: vi.fn(async () => {}),
    onCompleted: vi.fn(),
  };
  return { jobs: new ImportJobs(dependencies), ...dependencies };
}
const flush = () => new Promise((done) => setTimeout(done));

describe("ImportJobs", () => {
  it("publishes progress immediately, prevents duplicate work, and completes only after sync", async () => {
    const { jobs, send, waitForSync, onCompleted } = setup();
    const imported = deferred<ImportResult>();
    const synced = deferred<void>();
    send.mockReturnValue(imported.promise);
    waitForSync.mockReturnValue(synced.promise);
    const states: string[] = [];
    jobs.subscribe(() =>
      states.push(jobs.getForSlot(target)?.status ?? "complete"),
    );
    const work = jobs.start("list", link, plan);
    await jobs.start("list", link, plan);
    expect(send).toHaveBeenCalledTimes(1);
    expect(states).toEqual(["importing"]);
    imported.resolve(result);
    await flush();
    expect(states).toEqual(["importing", "syncing"]);
    expect(onCompleted).not.toHaveBeenCalled();
    synced.resolve();
    await work;
    expect(states).toEqual(["importing", "syncing", "complete"]);
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("lists cookbook imports apart from planned ones", async () => {
    const { jobs, send } = setup();
    send.mockReturnValue(new Promise(() => {}));
    const photos = { kind: "photos", photos: [], note: "" } as const;
    void jobs.start("list", photos);
    void jobs.start("list", link, plan);
    expect(
      jobs.getForCookbook("list").map((job) => job.request.source),
    ).toEqual([photos]);
    expect(jobs.getForSlot(target)?.request.source).toEqual(link);
  });

  it("re-sends a request that died once the app is active again", async () => {
    const { jobs, send, whenActive, createOperationId } = setup();
    const active = deferred<void>();
    whenActive.mockReturnValue(active.promise);
    send.mockRejectedValueOnce(
      new ImportFailure("NETWORK_ERROR", "Could not send", true),
    );
    const work = jobs.start("list", link, plan);
    await flush();
    expect(jobs.getForSlot(target)?.status).toBe("importing");
    expect(send).toHaveBeenCalledOnce();
    active.resolve();
    await work;
    expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
    expect(createOperationId).toHaveBeenCalledOnce();
    expect(jobs.getForSlot(target)).toBeUndefined();
  });

  it("keeps operation identity when the cook retries", async () => {
    const { jobs, send } = setup();
    const failure = new ImportFailure("NETWORK_ERROR", "Retry", true);
    send.mockRejectedValueOnce(failure).mockRejectedValueOnce(failure);
    await jobs.start("list", link, plan);
    const job = jobs.getForSlot(target);
    expect(job?.status).toBe("error");
    await jobs.retry(job!.request.operationId);
    expect(
      new Set(send.mock.calls.map((call) => JSON.stringify(call))).size,
    ).toBe(1);
    expect(jobs.getForSlot(target)).toBeUndefined();
  });

  it("retries only sync once the import was saved", async () => {
    const { jobs, send, waitForSync } = setup();
    waitForSync.mockRejectedValueOnce(
      new ImportFailure("SYNC_TIMEOUT", "Retry sync", true),
    );
    await jobs.start("list", link, plan);
    const job = jobs.getForSlot(target);
    expect(job).toMatchObject({ status: "error", result });
    await jobs.retry(job!.request.operationId);
    expect(send).toHaveBeenCalledOnce();
    expect(waitForSync).toHaveBeenCalledTimes(2);
  });

  it("requires dismissal of a non-retryable error and isolates other slots", async () => {
    const { jobs, send } = setup();
    send.mockRejectedValueOnce(
      new ImportFailure("MEAL_SLOT_OCCUPIED", "Choose another slot", false),
    );
    await jobs.start("list", link, plan);
    const job = jobs.getForSlot(target)!;
    await jobs.retry(job.request.operationId);
    await jobs.start(
      "list",
      { kind: "link", url: "https://another.example" },
      plan,
    );
    expect(send).toHaveBeenCalledOnce();
    await jobs.start("list", link, { ...plan, slot: "lunch" });
    expect(jobs.getForSlot(target)?.status).toBe("error");
    jobs.dismiss(job.request.operationId);
    expect(jobs.getForSlot(target)).toBeUndefined();
  });

  it("drops a cancelled import and ignores what its request still returns", async () => {
    const { jobs, send, onCompleted } = setup();
    const imported = deferred<ImportResult>();
    send.mockReturnValue(imported.promise);
    const work = jobs.start("list", link, plan);
    await jobs.cancel(jobs.getForSlot(target)!.request.operationId);
    expect(jobs.getForSlot(target)).toBeUndefined();
    imported.resolve(result);
    await work;
    expect(jobs.getForSlot(target)).toBeUndefined();
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it("says so when the cancel came after the save", async () => {
    const { jobs, send, cancel } = setup();
    send.mockReturnValue(new Promise(() => {}));
    cancel.mockResolvedValue({ outcome: "saved", ...result });
    void jobs.start("list", link, plan);
    await jobs.cancel(jobs.getForSlot(target)!.request.operationId);
    expect(jobs.getForSlot(target)).toMatchObject({
      status: "error",
      error: { code: "ALREADY_SAVED", retryable: false },
    });
  });

  it("ends an import that found several recipes once its review is on this phone", async () => {
    const { jobs, send, waitForSync, onCompleted } = setup();
    const review: ImportReview = { review: true };
    send.mockResolvedValue(review);
    await jobs.start("list", link);
    expect(waitForSync).toHaveBeenCalledWith(
      expect.objectContaining({ source: link }),
      review,
    );
    expect(jobs.getForCookbook("list")).toEqual([]);
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
