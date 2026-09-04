import type { ExecutionNode, Message, Run } from "@openbot/domain";
import { protocolVersion } from "@openbot/protocol";
import { describe, expect, it } from "vitest";
import type { NodeRunMessage } from "./node-registry.js";
import type { NodeGateway } from "./run-dispatcher.js";
import { RunDispatcher } from "./run-dispatcher.js";
import { RunFrameStore } from "./run-frame-store.js";

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
  osVersion: "6.8.0",
  architecture: "x64",
  deviceClass: "server",
  isolation: "unknown",
  trustTier: "development",
  capabilities: ["browser", "shell", "screenshot"],
  capabilityManifest: [
    { id: "browser.observe", version: 1, providerId: "docker", constraints: {} },
    { id: "screen.capture", version: 1, providerId: "docker", constraints: {} },
  ],
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
      async getRunningRunForNode() {
        return undefined;
      },
      async appendRunProgress() {
        return undefined;
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
    await dispatcher.stop();
  });

  it("leaves a run queued when no Node satisfies its fixed profile", async () => {
    const run = queuedRun();
    let offered = false;
    const dispatcher = new RunDispatcher(
      {
        async listDispatchableRuns() {
          return [run];
        },
        async getRunningRunForNode() {
          return undefined;
        },
        async appendRunProgress() {
          return undefined;
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
    await dispatcher.stop();
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
        async getRunningRunForNode() {
          return undefined;
        },
        async appendRunProgress() {
          return undefined;
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
    await dispatcher.stop();
  });

  it("starts an assigned run and durably completes it before releasing Node capacity", async () => {
    const run = queuedRun();
    const projectedStatuses: Run["status"][] = [];
    const projectedProgress: string[] = [];
    const projectedFrames: number[] = [];
    const projectedMessages: Message[] = [];
    const settled: Array<{ runId: string; status: "completed" | "failed" }> = [];
    const projectedApprovals: string[] = [];
    const projectedWorkspaceStatuses: Run["status"][] = [];
    let runHandler: ((node: ExecutionNode, message: NodeRunMessage) => void) | undefined;
    const dispatcher = new RunDispatcher(
      {
        async listDispatchableRuns() {
          return run.status === "queued" ? [run] : [];
        },
        async getRunningRunForNode(runId, nodeId) {
          return run.id === runId && run.nodeId === nodeId && run.status === "running"
            ? run
            : undefined;
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
        async appendRunProgress(_runId, nodeId, stage, message) {
          return {
            id: "00000000-0000-4000-8000-000000000004",
            runId: run.id,
            channelId: run.channelId,
            nodeId,
            stage,
            message,
            createdAt: "2026-09-03T00:01:00.000Z",
          };
        },
        async requestApproval(_runId, nodeId, input) {
          if (run.status !== "running" || run.nodeId !== nodeId) return undefined;
          run.status = "waiting_approval";
          return {
            approval: {
              id: input.requestId,
              runId: run.id,
              channelId: run.channelId,
              botId: run.botId,
              nodeId,
              action: input.action,
              target: input.target,
              summary: input.summary,
              risk: input.risk,
              targetFingerprint: "0".repeat(64),
              beforeState: input.beforeState,
              status: "pending",
              expiresAt: input.expiresAt,
              createdAt: "2026-09-03T00:01:00.000Z",
            },
            run,
          };
        },
        async completeRun(_runId, nodeId, summary, artifacts) {
          if (run.status !== "running" || run.nodeId !== nodeId) return undefined;
          run.status = "completed";
          run.resultSummary = summary;
          return {
            run,
            artifacts,
            message: {
              id: "00000000-0000-4000-8000-000000000010",
              channelId: run.channelId,
              authorType: "bot",
              authorId: run.botId,
              runId: run.id,
              content: summary,
              createdAt: new Date().toISOString(),
            },
          };
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
          if (event.type === "run.progress") projectedProgress.push(event.progress.message);
          if (event.type === "run.frame") projectedFrames.push(event.frame.revision);
          if (event.type === "message.created") projectedMessages.push(event.message);
        },
      },
      artifactStorage,
      new RunFrameStore(),
      {
        publish(event) {
          if (event.type === "approval.updated") projectedApprovals.push(event.approval.id);
          if (event.type === "run.updated") projectedWorkspaceStatuses.push(event.run.status);
        },
      },
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
      type: "approval.request",
      protocolVersion,
      nodeId: linuxNode.id,
      runId: run.id,
      requestId: "00000000-0000-4000-8000-000000000009",
      action: "form.submit",
      target: "https://example.test/form#signup",
      summary: "提交测试表单",
      risk: "write",
      beforeState: { fields: 3 },
      expiresInSeconds: 300,
      requestedAt: new Date().toISOString(),
    });
    await waitFor(() => run.status === "waiting_approval");
    expect(projectedApprovals).toEqual(["00000000-0000-4000-8000-000000000009"]);
    run.status = "running";

    runHandler?.(linuxNode, {
      type: "run.progress",
      protocolVersion,
      nodeId: linuxNode.id,
      runId: run.id,
      stage: "navigate",
      message: "正在打开测试页",
      occurredAt: new Date().toISOString(),
    });

    runHandler?.(linuxNode, {
      type: "run.frame",
      protocolVersion,
      nodeId: linuxNode.id,
      runId: run.id,
      mediaType: "image/png",
      base64: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString(
        "base64",
      ),
      width: 1280,
      height: 800,
      capturedAt: new Date().toISOString(),
    });

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
    expect(projectedProgress).toEqual(["正在打开测试页"]);
    expect(projectedFrames).toEqual([1]);
    expect(projectedMessages).toMatchObject([
      { authorType: "bot", authorId: run.botId, content: "已打开页面并截图" },
    ]);
    expect(settled).toEqual([{ runId: run.id, status: "completed" }]);
    expect(projectedStatuses).toEqual(["assigned", "running", "waiting_approval", "completed"]);
    expect(projectedWorkspaceStatuses).toEqual([
      "assigned",
      "running",
      "waiting_approval",
      "completed",
    ]);
    await dispatcher.stop();
  });

  it("rejects approval actions that are absent from the Server policy catalog", async () => {
    const harness = createApprovalHarness();
    await harness.dispatcher.start();

    harness.send({ action: "shell.execute", target: "host:local", risk: "privileged" });
    await waitFor(() => harness.failedErrors.length === 1);

    expect(harness.requestedRisks).toEqual([]);
    expect(harness.cancelled).toEqual([
      "Execution requested an action that Server policy does not permit.",
    ]);
    await harness.dispatcher.stop();
  });

  it("rejects a Node risk below the Server policy minimum", async () => {
    const harness = createApprovalHarness([
      {
        id: "destructive-test-action",
        action: "record.delete",
        effect: "require_approval",
        minimumRisk: "destructive",
      },
    ]);
    await harness.dispatcher.start();

    harness.send({ action: "record.delete", target: "record:1", risk: "write" });
    await waitFor(() => harness.failedErrors.length === 1);

    expect(harness.requestedRisks).toEqual([]);
    expect(harness.cancelled).toEqual([
      "Execution reported a risk below the Server policy minimum.",
    ]);
    await harness.dispatcher.stop();
  });

  it("persists the Server policy risk instead of a higher Node claim", async () => {
    const harness = createApprovalHarness();
    await harness.dispatcher.start();

    harness.send({
      action: "form.submit",
      target: "https://example.test/form",
      risk: "privileged",
    });
    await waitFor(() => harness.requestedRisks.length === 1);

    expect(harness.requestedRisks).toEqual(["write"]);
    expect(harness.failedErrors).toEqual([]);
    await harness.dispatcher.stop();
  });

  it("drains accepted Node messages and ignores new ones after stop", async () => {
    let runHandler: ((node: ExecutionNode, message: NodeRunMessage) => void) | undefined;
    let releaseProgress: (() => void) | undefined;
    let progressWrites = 0;
    const progressBlocked = new Promise<void>((resolve) => {
      releaseProgress = resolve;
    });
    const dispatcher = new RunDispatcher(
      {
        async listDispatchableRuns() {
          return [];
        },
        async getRunningRunForNode() {
          return undefined;
        },
        async appendRunProgress() {
          progressWrites += 1;
          await progressBlocked;
          return undefined;
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
        list: () => [],
        onAvailable: () => () => undefined,
        onUnavailable: () => () => undefined,
        onRunMessage: (handler) => {
          runHandler = handler;
          return () => undefined;
        },
        offerRun: async () => ({ status: "unavailable" }),
        confirmRun: () => false,
        startRun: () => false,
        settleRun: () => undefined,
        cancelRun: () => undefined,
      },
      { publish: () => undefined },
      artifactStorage,
    );
    await dispatcher.start();

    const progress: NodeRunMessage = {
      type: "run.progress",
      protocolVersion,
      nodeId: linuxNode.id,
      runId: queuedRun().id,
      stage: "persist",
      message: "正在保存结果",
      occurredAt: new Date().toISOString(),
    };
    runHandler?.(linuxNode, progress);
    await waitFor(() => progressWrites === 1);

    const firstStop = dispatcher.stop();
    expect(dispatcher.stop()).toBe(firstStop);
    let stopped = false;
    void firstStop.then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);

    runHandler?.(linuxNode, progress);
    await Promise.resolve();
    expect(progressWrites).toBe(1);

    releaseProgress?.();
    await firstStop;
    expect(stopped).toBe(true);
    await expect(dispatcher.start()).rejects.toThrow("cannot be restarted");
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

function createApprovalHarness(policyRules?: ConstructorParameters<typeof RunDispatcher>[6]) {
  let runHandler: ((node: ExecutionNode, message: NodeRunMessage) => void) | undefined;
  const requestedRisks: string[] = [];
  const failedErrors: string[] = [];
  const cancelled: string[] = [];
  const dispatcher = new RunDispatcher(
    {
      async listDispatchableRuns() {
        return [];
      },
      async getRunningRunForNode() {
        return undefined;
      },
      async appendRunProgress() {
        return undefined;
      },
      async requestApproval(_runId, _nodeId, input) {
        requestedRisks.push(input.risk);
        return undefined;
      },
      async completeRun() {
        return undefined;
      },
      async failRun(_runId, _nodeId, error) {
        failedErrors.push(error);
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
      list: () => [],
      onAvailable: () => () => undefined,
      onUnavailable: () => () => undefined,
      onRunMessage: (handler) => {
        runHandler = handler;
        return () => undefined;
      },
      offerRun: async () => ({ status: "unavailable" }),
      confirmRun: () => false,
      startRun: () => false,
      settleRun: () => undefined,
      cancelRun: (_nodeId, _runId, reason) => cancelled.push(reason),
    },
    { publish: () => undefined },
    artifactStorage,
    undefined,
    undefined,
    policyRules,
  );

  return {
    dispatcher,
    requestedRisks,
    failedErrors,
    cancelled,
    send(input: { action: string; target: string; risk: "write" | "destructive" | "privileged" }) {
      runHandler?.(linuxNode, {
        type: "approval.request",
        protocolVersion,
        nodeId: linuxNode.id,
        runId: queuedRun().id,
        requestId: "00000000-0000-4000-8000-000000000011",
        action: input.action,
        target: input.target,
        summary: "Review the prepared action",
        risk: input.risk,
        beforeState: {},
        expiresInSeconds: 300,
        requestedAt: new Date().toISOString(),
      });
    },
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for dispatcher state.");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
