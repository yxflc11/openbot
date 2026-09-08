import type { Run } from "@openbot/domain";
import type { ChannelRealtimeHub } from "./channel-realtime-hub.js";
import type { RunCompletion } from "./control-plane-store.js";
import { type ModelChatInput, type ModelClient, ModelRequestError } from "./model-client.js";
import type { WebToolName, WebToolPhase } from "./model-web-tools.js";
import type { WorkspaceRealtimeHub } from "./workspace-realtime-hub.js";

export interface ModelRunStore {
  listModelRuns(): Promise<Run[]>;
  claimModelRun(runId: string): Promise<Run | undefined>;
  getModelInput(run: Run): Promise<ModelChatInput>;
  recordModelToolEvent?(runId: string, name: WebToolName, phase: WebToolPhase): Promise<void>;
  completeModelRun(runId: string, reply: string): Promise<RunCompletion | undefined>;
  failModelRun(runId: string, error: string): Promise<Run | undefined>;
}

type ModelResolver = (run: Run) => Promise<ModelClient | undefined>;

/** A bounded single-Server scheduler; durable claims and all identity stay in PostgreSQL. */
export class ModelRunDispatcher {
  readonly #store: ModelRunStore;
  readonly #model: ModelClient | ModelResolver | undefined;
  readonly #realtime: Pick<ChannelRealtimeHub, "publish">;
  readonly #workspace: Pick<WorkspaceRealtimeHub, "publish">;
  readonly #capacity: number;
  readonly #active = new Map<string, { abort: AbortController; done: Promise<void> }>();
  #stopped = true;
  #started = false;
  #drain: Promise<void> | undefined;
  #again = false;

  constructor(
    store: ModelRunStore,
    model: ModelClient | ModelResolver | undefined,
    realtime: Pick<ChannelRealtimeHub, "publish">,
    workspace: Pick<WorkspaceRealtimeHub, "publish">,
    capacity = 2,
  ) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 4)
      throw new Error("Invalid model capacity.");
    this.#store = store;
    this.#model = model;
    this.#realtime = realtime;
    this.#workspace = workspace;
    this.#capacity = capacity;
  }

  async start(): Promise<void> {
    if (this.#started) throw new Error("Model dispatcher cannot be restarted.");
    this.#started = true;
    this.#stopped = false;
    await this.dispatchQueued();
  }

  enqueue(run: Run): void {
    if (run.executionProfile !== "model" || run.status !== "queued") return;
    void this.dispatchQueued().catch(reportFailure);
  }

  async stop(): Promise<void> {
    this.#stopped = true;
    for (const work of this.#active.values()) work.abort.abort();
    await this.#drain;
    // A database claim already in flight at stop may have finished after the first abort pass.
    for (const work of this.#active.values()) work.abort.abort();
    await Promise.all(Array.from(this.#active.values(), (work) => work.done));
  }

  async dispatchQueued(): Promise<void> {
    if (this.#stopped) return;
    if (this.#drain !== undefined) {
      this.#again = true;
      return this.#drain;
    }
    const drain = this.#drainQueued();
    this.#drain = drain;
    try {
      await drain;
    } finally {
      this.#drain = undefined;
      if (this.#again && !this.#stopped) void this.dispatchQueued().catch(reportFailure);
    }
  }

  async #drainQueued(): Promise<void> {
    do {
      this.#again = false;
      if (this.#active.size >= this.#capacity) return;
      const queued = await this.#store.listModelRuns();
      for (const run of queued) {
        if (this.#stopped || this.#active.size >= this.#capacity) break;
        if (run.executionProfile !== "model" || run.status !== "queued" || run.nodeId !== undefined)
          continue;
        const conversation = `${run.channelId}:${run.botId}`;
        if (this.#active.has(conversation)) continue;
        const claimed = await this.#store.claimModelRun(run.id);
        if (claimed === undefined) continue;
        this.#publish(claimed);
        const abort = new AbortController();
        if (this.#stopped) abort.abort();
        const done = this.#execute(claimed, abort.signal)
          .catch(reportFailure)
          .finally(() => {
            this.#active.delete(conversation);
            void this.dispatchQueued().catch(reportFailure);
          });
        this.#active.set(conversation, { abort, done });
      }
    } while (this.#again && !this.#stopped);
  }

  async #execute(run: Run, signal: AbortSignal): Promise<void> {
    try {
      signal.throwIfAborted();
      const model = typeof this.#model === "function" ? await this.#model(run) : this.#model;
      if (model === undefined)
        throw new ModelRequestError(
          "尚未配置模型服务，请添加模型服务并为员工选择模型，或配置服务端默认 Kimi。",
        );
      signal.throwIfAborted();
      const input = await this.#store.getModelInput(run);
      signal.throwIfAborted();
      const reply = await model.complete(input, signal, {
        onTool: async (name, phase) => {
          signal.throwIfAborted();
          if (!this.#store.recordModelToolEvent)
            throw new ModelRequestError("联网检索审计尚未配置。");
          await this.#store.recordModelToolEvent(run.id, name, phase);
        },
      });
      signal.throwIfAborted();
      const completed = await this.#store.completeModelRun(run.id, reply);
      if (completed === undefined) return;
      this.#publish(completed.run);
      this.#realtime.publish({
        type: "message.created",
        channelId: completed.run.channelId,
        message: completed.message,
      });
    } catch (error) {
      const reason = signal.aborted
        ? "模型请求已取消。"
        : error instanceof ModelRequestError
          ? error.message
          : "模型任务执行失败，请稍后重试。";
      const failed = await this.#store.failModelRun(run.id, reason);
      if (failed !== undefined) this.#publish(failed);
    }
  }

  #publish(run: Run): void {
    this.#realtime.publish({ type: "run.updated", channelId: run.channelId, run });
    this.#workspace.publish({ type: "run.updated", run });
  }
}

function reportFailure(): void {
  console.error("Model dispatcher could not persist a lifecycle transition.");
}
