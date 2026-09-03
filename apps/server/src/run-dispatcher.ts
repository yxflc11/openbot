import type { ExecutionNode, Run } from "@openbot/domain";
import type { CompletedArtifact } from "@openbot/protocol";
import type { ArtifactStorage } from "./artifact-storage.js";
import type { ChannelRealtimeHub } from "./channel-realtime-hub.js";
import type { ArtifactRecord, ControlPlaneStore } from "./control-plane-store.js";
import { selectExecutionNode } from "./execution-routing.js";
import type {
  NodeRegistry,
  NodeRunMessage,
  RunOfferInput,
  RunOfferResult,
} from "./node-registry.js";
import type { RunFrameStore } from "./run-frame-store.js";

type DispatchStore = Pick<
  ControlPlaneStore,
  | "appendRunProgress"
  | "assignRun"
  | "completeRun"
  | "failRun"
  | "failRunningRuns"
  | "getRunningRunForNode"
  | "listDispatchableRuns"
  | "markNodeOffline"
  | "requeueAssignedRuns"
  | "startRun"
  | "upsertNode"
>;

export interface NodeGateway {
  list(): ExecutionNode[];
  onAvailable(handler: (node: ExecutionNode) => void): () => void;
  onUnavailable(handler: (node: ExecutionNode) => void): () => void;
  onRunMessage(handler: (node: ExecutionNode, message: NodeRunMessage) => void): () => void;
  offerRun(nodeId: string, input: RunOfferInput): Promise<RunOfferResult>;
  confirmRun(nodeId: string, runId: string): boolean;
  startRun(nodeId: string, runId: string): boolean;
  settleRun(nodeId: string, runId: string, status: "completed" | "failed"): void;
  cancelRun(nodeId: string, runId: string, reason: string): void;
}

type RunPublisher = Pick<ChannelRealtimeHub, "publish">;
type FramePublisher = Pick<RunFrameStore, "publish">;

export class RunDispatcher {
  readonly #store: DispatchStore;
  readonly #nodes: NodeGateway;
  readonly #realtime: RunPublisher;
  readonly #artifacts: ArtifactStorage;
  readonly #frames: FramePublisher | undefined;
  readonly #runMessageTails = new Map<string, Promise<void>>();
  #draining = false;
  #drainAgain = false;
  #stopped = true;
  #unsubscribeAvailable?: () => void;
  #unsubscribeUnavailable?: () => void;
  #unsubscribeRunMessage?: () => void;

  constructor(
    store: DispatchStore,
    nodes: NodeRegistry | NodeGateway,
    realtime: RunPublisher,
    artifacts: ArtifactStorage,
    frames?: FramePublisher,
  ) {
    this.#store = store;
    this.#nodes = nodes;
    this.#realtime = realtime;
    this.#artifacts = artifacts;
    this.#frames = frames;
  }

  async start(): Promise<void> {
    this.#stopped = false;
    this.#unsubscribeAvailable = this.#nodes.onAvailable((node) => {
      void this.#handleNodeAvailable(node).catch(reportDispatchError);
    });
    this.#unsubscribeUnavailable = this.#nodes.onUnavailable((node) => {
      void this.#handleNodeUnavailable(node).catch(reportDispatchError);
    });
    this.#unsubscribeRunMessage = this.#nodes.onRunMessage((node, message) => {
      this.#enqueueRunMessage(node, message);
    });

    const [requeued, failed] = await Promise.all([
      this.#store.requeueAssignedRuns(),
      this.#store.failRunningRuns(),
    ]);
    this.#publishUpdates([...requeued, ...failed]);
    await this.dispatchQueued();
  }

  stop(): void {
    this.#stopped = true;
    this.#unsubscribeAvailable?.();
    this.#unsubscribeUnavailable?.();
    this.#unsubscribeRunMessage?.();
    this.#runMessageTails.clear();
  }

  enqueue(run: Run): void {
    if (run.status !== "queued" || run.executionProfile === "none") return;
    void this.dispatchQueued().catch(reportDispatchError);
  }

  async dispatchQueued(): Promise<void> {
    if (this.#stopped) return;
    if (this.#draining) {
      this.#drainAgain = true;
      return;
    }

    this.#draining = true;
    try {
      do {
        this.#drainAgain = false;
        const queued = await this.#store.listDispatchableRuns();
        for (const run of queued) {
          if (this.#stopped) return;
          await this.#offer(run);
        }
      } while (this.#drainAgain && !this.#stopped);
    } finally {
      this.#draining = false;
    }
  }

  async #offer(run: Run): Promise<void> {
    const route = selectExecutionNode(run, this.#nodes.list());
    if (route === undefined) return;
    const { node, requirements } = route;
    const result = await this.#nodes.offerRun(node.id, {
      runId: run.id,
      channelId: run.channelId,
      botId: run.botId,
      title: run.title,
      instruction: run.instruction,
      executionProfile: requirements.executionProfile,
      requiredCapabilities: requirements.capabilities,
    });
    if (result.status !== "accepted") return;

    const assigned = await this.#store.assignRun(run.id, node.id);
    if (assigned === undefined) {
      this.#nodes.cancelRun(node.id, run.id, "Run was claimed by another dispatcher.");
      return;
    }
    if (!this.#nodes.confirmRun(node.id, run.id)) {
      const requeued = await this.#store.requeueAssignedRuns(node.id);
      this.#publishUpdates(requeued);
      return;
    }
    this.#publishUpdates([assigned]);
  }

  async #handleNodeAvailable(node: ExecutionNode): Promise<void> {
    await this.#store.upsertNode(node);
    const [requeued, failed] = await Promise.all([
      this.#store.requeueAssignedRuns(node.id),
      this.#store.failRunningRuns(node.id),
    ]);
    this.#publishUpdates([...requeued, ...failed]);
    await this.dispatchQueued();
  }

  async #handleNodeUnavailable(node: ExecutionNode): Promise<void> {
    await this.#store.markNodeOffline(node.id);
    const [requeued, failed] = await Promise.all([
      this.#store.requeueAssignedRuns(node.id),
      this.#store.failRunningRuns(node.id),
    ]);
    this.#publishUpdates([...requeued, ...failed]);
    await this.dispatchQueued();
  }

  #enqueueRunMessage(node: ExecutionNode, message: NodeRunMessage): void {
    const previous = this.#runMessageTails.get(message.runId) ?? Promise.resolve();
    const next = previous
      .then(() => this.#handleRunMessage(node, message))
      .catch(reportDispatchError);
    this.#runMessageTails.set(message.runId, next);
    void next.finally(() => {
      if (this.#runMessageTails.get(message.runId) === next) {
        this.#runMessageTails.delete(message.runId);
      }
    });
  }

  async #handleRunMessage(node: ExecutionNode, message: NodeRunMessage): Promise<void> {
    switch (message.type) {
      case "run.start_request": {
        const started = await this.#store.startRun(message.runId, node.id);
        if (started === undefined) {
          this.#nodes.cancelRun(node.id, message.runId, "Run is no longer assignable.");
          return;
        }
        if (!this.#nodes.startRun(node.id, message.runId)) {
          const failed = await this.#store.failRun(
            message.runId,
            node.id,
            "Node disconnected before execution could start.",
          );
          if (failed !== undefined) {
            this.#nodes.settleRun(node.id, message.runId, "failed");
            this.#publishUpdates([failed]);
            await this.dispatchQueued();
          }
          return;
        }
        this.#publishUpdates([started]);
        return;
      }
      case "run.progress": {
        const progress = await this.#store.appendRunProgress(
          message.runId,
          node.id,
          message.stage,
          message.message,
        );
        if (progress !== undefined) {
          this.#realtime.publish({
            type: "run.progress",
            channelId: progress.channelId,
            progress,
          });
        }
        return;
      }
      case "run.frame": {
        if (this.#frames === undefined) return;
        const run = await this.#store.getRunningRunForNode(message.runId, node.id);
        if (run === undefined) return;
        const frame = this.#frames.publish(run.channelId, message);
        if (frame !== undefined) {
          this.#realtime.publish({ type: "run.frame", channelId: run.channelId, frame });
        }
        return;
      }
      case "run.completed":
        await this.#completeRun(node.id, message.runId, message.summary, message.artifacts);
        return;
      case "run.failed": {
        const failed = await this.#store.failRun(message.runId, node.id, message.error);
        if (failed !== undefined) {
          this.#nodes.settleRun(node.id, message.runId, "failed");
          this.#publishUpdates([failed]);
          await this.dispatchQueued();
        }
      }
    }
  }

  async #completeRun(
    nodeId: string,
    runId: string,
    summary: string,
    inputs: CompletedArtifact[],
  ): Promise<void> {
    let persisted: ArtifactRecord[] = [];
    try {
      persisted = (await this.#artifacts.persist(runId, inputs)).map((record) => ({
        ...record.artifact,
        storageKey: record.storageKey,
        metadata: record.metadata,
      }));
      const completion = await this.#store.completeRun(runId, nodeId, summary, persisted);
      if (completion === undefined) {
        await this.#artifacts.remove(persisted.map((artifact) => artifact.storageKey));
        this.#nodes.cancelRun(nodeId, runId, "Run is no longer running on this Node.");
        return;
      }
      this.#nodes.settleRun(nodeId, runId, "completed");
      this.#realtime.publish({
        type: "run.updated",
        channelId: completion.run.channelId,
        run: completion.run,
        artifacts: completion.artifacts,
      });
      await this.dispatchQueued();
    } catch (error) {
      await this.#artifacts.remove(persisted.map((artifact) => artifact.storageKey));
      const failed = await this.#store.failRun(
        runId,
        nodeId,
        error instanceof Error ? error.message : "The result artifact could not be persisted.",
      );
      if (failed !== undefined) {
        this.#nodes.settleRun(nodeId, runId, "failed");
        this.#publishUpdates([failed]);
        await this.dispatchQueued();
      }
    }
  }

  #publishUpdates(runs: Run[]): void {
    for (const run of runs) {
      this.#realtime.publish({ type: "run.updated", channelId: run.channelId, run });
    }
  }
}

function reportDispatchError(error: unknown): void {
  console.error("Run dispatcher failed.", error);
}
