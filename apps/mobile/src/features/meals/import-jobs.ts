import type { ImageAttachment } from "@/features/chat/image-attachment";

import type { MealSlot } from "./slots";
import { ImportFailure, importFailure } from "./import-failure";

export type ImportTarget = Readonly<{
  listId: string;
  date: string;
  slot: MealSlot;
}>;
export type ImportPlan = Readonly<{ date: string; slot: MealSlot }>;
export type ImportSource = Readonly<
  | { kind: "link"; url: string }
  | { kind: "text"; text: string }
  | { kind: "photos"; photos: readonly ImageAttachment[]; note: string }
>;
export type ImportRequest = Readonly<{
  operationId: string;
  listId: string;
  /** Also plan the recipe into this slot; the cookbook only without it. */
  plan?: ImportPlan;
  source: ImportSource;
}>;
export type ImportResult = Readonly<{ recipeId: string; variantId: string }>;
/** More than one recipe, or part of one: the cook chooses from the synced
 *  review, which outlives this job (ADR 35). */
export type ImportReview = Readonly<{ review: true }>;
export type ImportOutcome = ImportResult | ImportReview;
export type CancelOutcome =
  { outcome: "cancelled" } | ({ outcome: "saved" } & ImportResult);
export type ImportJob = Readonly<
  {
    request: ImportRequest;
  } & (
    | { status: "importing" }
    | { status: "cancelling" }
    | { status: "syncing"; result: ImportOutcome }
    | { status: "error"; error: ImportFailure; result?: ImportOutcome }
  )
>;

type Dependencies = {
  createOperationId: () => string;
  send: (request: ImportRequest) => Promise<ImportOutcome>;
  waitForSync: (request: ImportRequest, result: ImportOutcome) => Promise<void>;
  /** Recorded on the server, so it holds even if the request is gone. */
  cancel: (operationId: string) => Promise<CancelOutcome>;
  /** Resolves once the app is in the foreground. */
  whenActive: () => Promise<void>;
  onCompleted: (request: ImportRequest) => void;
};

/** A request dies when the phone locks; the server carries on regardless. */
const uncertain = new Set(["NETWORK_ERROR", "REQUEST_TIMEOUT"]);

/** Owns the lifecycle. HTTP, local sync, and native feedback are injected. */
export class ImportJobs {
  private jobs: readonly ImportJob[] = [];
  private readonly cancelled = new Set<string>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly dependencies: Dependencies) {}

  readonly getSnapshot = (): readonly ImportJob[] => this.jobs;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getForSlot(target: ImportTarget): ImportJob | undefined {
    return this.jobs.find(
      ({ request: { listId, plan } }) =>
        listId === target.listId &&
        plan?.date === target.date &&
        plan.slot === target.slot,
    );
  }

  getForCookbook(listId: string): readonly ImportJob[] {
    return this.jobs.filter(
      ({ request }) => request.listId === listId && !request.plan,
    );
  }

  async start(
    listId: string,
    source: ImportSource,
    plan?: ImportPlan,
  ): Promise<void> {
    // An existing failure must be retried or dismissed explicitly.
    if (plan && this.getForSlot({ listId, ...plan })) return;
    await this.run({
      operationId: this.dependencies.createOperationId(),
      listId,
      plan: plan && { ...plan },
      source,
    });
  }

  async retry(operationId: string): Promise<void> {
    const job = this.find(operationId);
    if (job?.status !== "error" || !job.error.retryable) return;
    await this.run(job.request, job.result);
  }

  dismiss(operationId: string): void {
    const job = this.find(operationId);
    if (job?.status === "error") this.remove(job.request);
  }

  /** Throws if the server could not be told; the import then carries on. */
  async cancel(operationId: string): Promise<void> {
    const job = this.find(operationId);
    if (job?.status !== "importing") return;
    this.publish({ request: job.request, status: "cancelling" });
    let outcome: CancelOutcome;
    try {
      outcome = await this.dependencies.cancel(operationId);
    } catch (error) {
      if (this.find(operationId)?.status === "cancelling")
        this.publish({ request: job.request, status: "importing" });
      throw error;
    }
    this.cancelled.add(operationId);
    if (outcome.outcome === "cancelled") {
      this.remove(job.request);
      return;
    }
    this.write({
      request: job.request,
      status: "error",
      error: new ImportFailure(
        "ALREADY_SAVED",
        job.request.plan
          ? "It was already saved and planned."
          : "It was already saved to your cookbook.",
        false,
      ),
      result: outcome,
    });
  }

  private find(operationId: string): ImportJob | undefined {
    return this.jobs.find((job) => job.request.operationId === operationId);
  }

  private async run(
    request: ImportRequest,
    saved?: ImportOutcome,
  ): Promise<void> {
    let result = saved;
    try {
      if (!result) {
        this.publish({ request, status: "importing" });
        result = await this.send(request);
      }
      this.publish({ request, status: "syncing", result });
      await this.dependencies.waitForSync(request, result);
    } catch (error) {
      this.publish({
        request,
        status: "error",
        error: importFailure(error),
        result,
      });
      return;
    }
    if (this.cancelled.has(request.operationId)) return;
    this.remove(request);
    // A review is not an import yet; the cook's choice completes it.
    if (!("review" in result)) this.dependencies.onCompleted(request);
  }

  /** Sends once more when the app is back, with the same operation. */
  private async send(request: ImportRequest): Promise<ImportOutcome> {
    try {
      return await this.dependencies.send(request);
    } catch (error) {
      if (!(error instanceof ImportFailure) || !uncertain.has(error.code))
        throw error;
      await this.dependencies.whenActive();
      return this.dependencies.send(request);
    }
  }

  /** A cancelled import's own outcome no longer shows. */
  private publish(job: ImportJob): void {
    if (!this.cancelled.has(job.request.operationId)) this.write(job);
  }

  private write(job: ImportJob): void {
    this.jobs = [
      ...this.jobs.filter(
        (existing) => existing.request.operationId !== job.request.operationId,
      ),
      job,
    ];
    this.listeners.forEach((listener) => listener());
  }

  private remove(request: ImportRequest): void {
    this.jobs = this.jobs.filter(
      (job) => job.request.operationId !== request.operationId,
    );
    this.listeners.forEach((listener) => listener());
  }
}
