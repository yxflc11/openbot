import type { ExecutionNode, Run } from "@openbot/domain";
import { protocolVersion } from "@openbot/protocol";
import { describe, expect, it } from "vitest";
import type { NodeRunMessage } from "./node-registry.js";
import type { NodeGateway } from "./run-dispatcher.js";
import { RunDispatcher } from "./run-dispatcher.js";

const queuedRun = (): Run => ({
  id: "00000000-0000-4000-8000-000000000001",
  channelId: "00000000-0000-4000-8000-000000000002",
  botId: "00000000-0000-4000-8000-000000000003",
  executionProfile: "docker-linux",
  instruction: "打开 https://example.test 并截图",
  title: "打开测试页并截图",
  status: "queued",
  createdAt: "2026-09-03T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
});

const linuxNode: ExecutionNode = {
  id: "linux-node",
  name: "Linux worker",
  platform: "linux",
  capabilities: ["browser", "shell", "screenshot"],
  activeRunIds: [],
  maxConcurrentRuns: 1,
  connectedAt: "2026-09-03T00:00:00.000Z",
  lastSeenAt: "2026-09-03T00:00:00.000Z",
};

describe("run dispatcher", () => {
  it("persists assignment only after a compatible Node accepts the offer", async () => {
    const run = queuedRun();
    const runs = [run];
    const events: Run[] = [];
    const confirmed: string[] = [];
    const gateway: NodeGateway = {
      list: () => [linuxNode],
      onAvailable: () => () => undefined,
      onUnavailable: () => () => undefined,
      onRunMessage: () => () => undefined,
      offerRun: async () => ({ status: "accepted" }),
      confirmRun: (_nodeId, runId) => {
        confirmed.push(runId);
        return true;
      },
      startRun: () => true,
      settleRun: () => undefined,
      cancelRun: () => undefined,
    };
    const store = {
      async listDispatchableRuns() {
        return runs.filter((item) => item.status === "queued");
      },
      async appendRunProgress() {
        return true;
      },
      async completeRun() {
        return undefined;
      },
      async failRun() {
        return undefined;
      },
      async failRunningRuns() {
        return [];
      },
      async assignRun(runId: string, nodeId: string) {
        const target = runs.find((item) => item.id === runId);
        if (target?.status !== "queued") return undefined;
        target.status = "assigned";
        target.nodeId = nodeId;
        return target;
      },
      async requeueAssignedRuns() {
        return [];
      },
      async startRun() {
        return undefined;
      },
      async upsertNode() {},
      async markNodeOffline() {},
    };
    const dispatcher = new RunDispatcher(
      store,
      gateway,
      {
        publish(event) {
          if (event.type === "run.updated") events.push(event.run);
        },
      },
      artifactStorage,
    );

    await dispatcher.start();

    expect(run).toMatchObject({ status: "assigned", nodeId: "linux-node" });
    expect(confirmed).toEqual([run.id]);
    expect(events).toHaveLength(1);
    dispatcher.stop();
  });

  it("leaves a run queued when no Node satisfies its fixed profile", async () => {
    const run = queuedRun();
    let offered = false;
    const dispatcher = new RunDispatcher(
      {
        async listDispatchableRuns() {
          return [run];
        },
        async appendRunProgress() {
          return true;
        },
        async completeRun() {
          return undefined;
        },
        async failRun() {
          return undefined;
        },
        async failRunningRuns() {
          return [];
        },
        async assignRun() {
          return undefined;
        },
        async requeueAssignedRuns() {
          return [];
        },
        async startRun() {
          return undefined;
        },
        async upsertNode() {},
        async markNodeOffline() {},
      },
      {
        list: () => [{ ...linuxNode, capabilities: ["shell"] }],
        onAvailable: () => () => undefined,
        onUnavailable: () => () => undefined,
        onRunMessage: () => () => undefined,
        offerRun: async () => {
          offered = true;
          return { status: "accepted" };
        },
        confirmRun: () => true,
        startRun: () => true,
        settleRun: () => undefined,
        cancelRun: () => undefined,
      },
      { publish: () => undefined },
      artifactStorage,
    );

    await dispatcher.start();

    expect(offered).toBe(false);
    expect(run.status).toBe("queued");
    dispatcher.stop();
  });

  it("requeues an accepted run when the Node disappears before confirmation", async () => {
    const run = queuedRun();
    const projectedStatuses: Run["status"][] = [];
    let requeueCalls = 0;
    const dispatcher = new RunDispatcher(
      {
        async listDispatchableRuns() {
          return run.status === "queued" ? [run] : [];
        },
        async appendRunProgress() {
          return true;
        },
        async completeRun() {
          return undefined;
        },
        async failRun() {
          return undefined;
        },
        async failRunningRuns() {
          return [];
        },
        async assignRun(_runId: string, nodeId: string) {
          run.status = "assigned";
          run.nodeId = nodeId;
          return run;
        },
        async requeueAssignedRuns() {
          requeueCalls += 1;
          if (run.status !== "assigned") return [];
          run.status = "queued";
          delete run.nodeId;
          return [run];
        },
        async startRun() {
          return undefined;
        },
        async upsertNode() {},
        async markNodeOffline() {},
      },
      {
        list: () => [linuxNode],
        onAvailable: () => () => undefined,
        onUnavailable: () => () => undefined,
        onRunMessage: () => () => undefined,
        offerRun: async () => ({ status: "accepted" }),
        confirmRun: () => false,
        startRun: () => false,
        settleRun: () => undefined,
        cancelRun: () => undefined,
      },
      {
        publish(event) {
          if (event.type === "run.updated") projectedStatuses.push(event.run.status);
        },
      },
      artifactStorage,
    );

    await dispatcher.start();

    expect(run).toMatchObject({ status: "queued" });
    expect(run.nodeId).toBeUndefined();
    expect(requeueCalls).toBe(2);
    expect(projectedStatuses).toEqual(["queued"]);
    dispatcher.stop();
  });

  it("starts an assigned run and durably completes it before releasing Node capacity", async () => {
    const run = queuedRun();
    const projectedStatuses: Run["status"][] = [];
    const settled: Array<{ runId: string; status: "completed" | "failed" }> = [];
    let runHandler: ((node: ExecutionNode, message: NodeRunMessage) => void) | undefined;
    const dispatcher = new RunDispatcher(
      {
        async listDispatchableRuns() {
          return run.status === "queued" ? [run] : [];
        },
        async assignRun(_runId: string, nodeId: string) {
          run.status = "assigned";
          run.nodeId = nodeId;
          return run;
        },
        async startRun(_runId: string, nodeId: string) {
          if (run.status !== "assigned" || run.nodeId !== nodeId) return undefined;
          run.status = "running";
          return run;
        },
        async appendRunProgress() {
          return true;
        },
        async completeRun(_runId, nodeId, summary, artifacts) {
          if (run.status !== "running" || run.nodeId !== nodeId) return undefined;
          run.status = "completed";
          run.resultSummary = summary;
          return { run, artifacts };
        },
        async failRun() {
          return undefined;
        },
        async failRunningRuns() {
          return [];
        },
        async requeueAssignedRuns() {
          return [];
        },
        async upsertNode() {},
        async markNodeOffline() {},
      },
      {
        list: () => [linuxNode],
        onAvailable: () => () => undefined,
        onUnavailable: () => () => undefined,
        onRunMessage: (handler) => {
          runHandler = handler;
          return () => undefined;
        },
        offerRun: async () => ({ status: "accepted" }),
        confirmRun: () => true,
        startRun: () => true,
        settleRun: (_nodeId, runId, status) => settled.push({ runId, status }),
        cancelRun: () => undefined,
      },
      {
        publish(event) {
          if (event.type === "run.updated") projectedStatuses.push(event.run.status);
        },
      },
      artifactStorage,
    );

    await dispatcher.start();
    expect(run.status).toBe("assigned");

    runHandler?.(linuxNode, {
      type: "run.start_request",
      protocolVersion,
      nodeId: linuxNode.id,
      runId: run.id,
      requestedAt: new Date().toISOString(),
    });
    await waitFor(() => run.status === "running");

    runHandler?.(linuxNode, {
      type: "run.completed",
      protocolVersion,
      nodeId: linuxNode.id,
      runId: run.id,
      summary: "已打开页面并截图",
      artifacts: [],
      completedAt: new Date().toISOString(),
    });
    await waitFor(() => run.status === "completed");

    expect(run.resultSummary).toBe("已打开页面并截图");
    expect(settled).toEqual([{ runId: run.id, status: "completed" }]);
    expect(projectedStatuses).toEqual(["assigned", "running", "completed"]);
    dispatcher.stop();
  });
});

const artifactStorage = {
  async persist() {
    return [];
  },
  async read() {
    return Buffer.alloc(0);
  },
  async remove() {},
};

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for dispatcher state.");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
