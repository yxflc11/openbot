import type { ExecutionNode, Run } from "@openbot/domain";
import type { ChannelRealtimeHub } from "./channel-realtime-hub.js";
import type { ControlPlaneStore } from "./control-plane-store.js";
import { selectExecutionNode } from "./execution-routing.js";
import type { NodeRegistry, RunOfferInput, RunOfferResult } from "./node-registry.js";

type DispatchStore = Pick<
  ControlPlaneStore,
  "assignRun" | "listDispatchableRuns" | "markNodeOffline" | "requeueAssignedRuns" | "upsertNode"
>;

export interface NodeGateway {
  list(): ExecutionNode[];
  onAvailable(handler: (node: ExecutionNode) => void): () => void;
  onUnavailable(handler: (node: ExecutionNode) => void): () => void;
  offerRun(nodeId: string, input: RunOfferInput): Promise<RunOfferResult>;
  confirmRun(nodeId: string, runId: string): boolean;
  cancelRun(nodeId: string, runId: string, reason: string): void;
}

type RunPublisher = Pick<ChannelRealtimeHub, "publish">;

export class RunDispatcher {
  readonly #store: DispatchStore;
  readonly #nodes: NodeGateway;
  readonly #realtime: RunPublisher;
  #draining = false;
  #drainAgain = false;
  #stopped = true;
  #unsubscribeAvailable?: () => void;
  #unsubscribeUnavailable?: () => void;

  constructor(store: DispatchStore, nodes: NodeRegistry | NodeGateway, realtime: RunPublisher) {
    this.#store = store;
    this.#nodes = nodes;
    this.#realtime = realtime;
  }

  async start(): Promise<void> {
    this.#stopped = false;
    this.#unsubscribeAvailable = this.#nodes.onAvailable((node) => {
      void this.#handleNodeAvailable(node).catch(reportDispatchError);
    });
    this.#unsubscribeUnavailable = this.#nodes.onUnavailable((node) => {
      void this.#handleNodeUnavailable(node).catch(reportDispatchError);
    });

    const recovered = await this.#store.requeueAssignedRuns();
    this.#publishUpdates(recovered);
    await this.dispatchQueued();
  }

  stop(): void {
    this.#stopped = true;
    this.#unsubscribeAvailable?.();
    this.#unsubscribeUnavailable?.();
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
    const recovered = await this.#store.requeueAssignedRuns(node.id);
    this.#publishUpdates(recovered);
    await this.dispatchQueued();
  }

  async #handleNodeUnavailable(node: ExecutionNode): Promise<void> {
    await this.#store.markNodeOffline(node.id);
    const requeued = await this.#store.requeueAssignedRuns(node.id);
    this.#publishUpdates(requeued);
    await this.dispatchQueued();
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
