import type { ExecutionNode, Run } from "@openbot/domain";
import { describe, expect, it } from "vitest";
import type { NodeGateway } from "./run-dispatcher.js";
import { RunDispatcher } from "./run-dispatcher.js";

const queuedRun = (): Run => ({
  id: "00000000-0000-4000-8000-000000000001",
  channelId: "00000000-0000-4000-8000-000000000002",
  botId: "00000000-0000-4000-8000-000000000003",
  executionProfile: "docker-linux",
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
      offerRun: async () => ({ status: "accepted" }),
      confirmRun: (_nodeId, runId) => {
        confirmed.push(runId);
        return true;
      },
      cancelRun: () => undefined,
    };
    const store = {
      async listDispatchableRuns() {
        return runs.filter((item) => item.status === "queued");
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
      async upsertNode() {},
      async markNodeOffline() {},
    };
    const dispatcher = new RunDispatcher(store, gateway, {
      publish(event) {
        if (event.type === "run.updated") events.push(event.run);
      },
    });

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
        async assignRun() {
          return undefined;
        },
        async requeueAssignedRuns() {
          return [];
        },
        async upsertNode() {},
        async markNodeOffline() {},
      },
      {
        list: () => [{ ...linuxNode, capabilities: ["shell"] }],
        onAvailable: () => () => undefined,
        onUnavailable: () => () => undefined,
        offerRun: async () => {
          offered = true;
          return { status: "accepted" };
        },
        confirmRun: () => true,
        cancelRun: () => undefined,
      },
      { publish: () => undefined },
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
        async upsertNode() {},
        async markNodeOffline() {},
      },
      {
        list: () => [linuxNode],
        onAvailable: () => () => undefined,
        onUnavailable: () => () => undefined,
        offerRun: async () => ({ status: "accepted" }),
        confirmRun: () => false,
        cancelRun: () => undefined,
      },
      {
        publish(event) {
          if (event.type === "run.updated") projectedStatuses.push(event.run.status);
        },
      },
    );

    await dispatcher.start();

    expect(run).toMatchObject({ status: "queued" });
    expect(run.nodeId).toBeUndefined();
    expect(requeueCalls).toBe(2);
    expect(projectedStatuses).toEqual(["queued"]);
    dispatcher.stop();
  });
});
