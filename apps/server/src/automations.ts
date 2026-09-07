import type { SubmitTaskResult } from "@openbot/domain";
import { z } from "zod";

const boundedId = z.string().min(1).max(128);
export const createAutomationInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    channelId: boundedId,
    botId: boundedId,
    prompt: z.string().trim().min(1).max(8000),
    intervalMinutes: z.number().int().min(15).max(10080),
    firstRunAt: z.iso.datetime(),
  })
  .strict();
export const updateAutomationInputSchema = z.object({ enabled: z.boolean() }).strict();
export type CreateAutomationInput = z.infer<typeof createAutomationInputSchema>;
export type AutomationOutcome = "submitted" | "skipped_active" | "target_unavailable";
export interface Automation {
  id: string;
  name: string;
  channelId: string;
  botId: string;
  prompt: string;
  intervalMinutes: number;
  enabled: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  lastRunId: string | null;
  lastOutcome: AutomationOutcome | null;
  createdAt: string;
}
export interface AutomationStore {
  list(): Promise<Automation[]>;
  create(input: CreateAutomationInput): Promise<Automation>;
  setEnabled(id: string, enabled: boolean): Promise<Automation>;
  delete(id: string): Promise<void>;
  submitDue(): Promise<SubmitTaskResult[]>;
}

/** Advance straight past downtime without replaying a backlog of missed occurrences. */
export function nextIntervalOccurrence(previous: Date, minutes: number, now: Date): Date {
  const interval = minutes * 60_000;
  if (
    !Number.isInteger(minutes) ||
    minutes < 15 ||
    minutes > 10080 ||
    !Number.isFinite(previous.getTime()) ||
    !Number.isFinite(now.getTime())
  ) {
    throw new Error("Invalid interval occurrence.");
  }
  if (previous > now) return previous;
  return new Date(
    previous.getTime() +
      (Math.floor((now.getTime() - previous.getTime()) / interval) + 1) * interval,
  );
}

export class AutomationScheduler {
  readonly #store: Pick<AutomationStore, "submitDue">;
  readonly #publish: (result: SubmitTaskResult) => void;
  readonly #onError: () => void;
  #timer: ReturnType<typeof setInterval> | undefined;
  #pending: Promise<void> | undefined;
  #stopped = true;
  constructor(
    store: Pick<AutomationStore, "submitDue">,
    publish: (result: SubmitTaskResult) => void,
    onError: () => void,
  ) {
    this.#store = store;
    this.#publish = publish;
    this.#onError = onError;
  }
  start(): void {
    if (!this.#stopped) return;
    this.#stopped = false;
    this.#timer = setInterval(() => {
      void this.tick();
    }, 15_000);
    this.#timer.unref();
    void this.tick();
  }
  tick(): Promise<void> {
    if (this.#stopped) return Promise.resolve();
    if (this.#pending) return this.#pending;
    this.#pending = this.#store
      .submitDue()
      .then((results) => {
        if (!this.#stopped) for (const result of results) this.#publish(result);
      })
      .catch(() => this.#onError())
      .finally(() => {
        this.#pending = undefined;
      });
    return this.#pending;
  }
  async stop(): Promise<boolean> {
    this.#stopped = true;
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
    if (!this.#pending) return true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // A pooled database connection can stall before transaction timeouts take effect.
      // Committed Runs remain durable and recover through dispatcher startup after a forced drain.
      return await Promise.race([
        this.#pending.then(() => true),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), 5000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
