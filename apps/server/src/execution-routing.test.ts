import type { ExecutionNode, Run } from "@openbot/domain";
import { describe, expect, it } from "vitest";
import { requirementsForRun, selectExecutionNode } from "./execution-routing.js";

const run: Run = {
  id: "00000000-0000-4000-8000-000000000001",
  channelId: "00000000-0000-4000-8000-000000000002",
  botId: "00000000-0000-4000-8000-000000000003",
  executionProfile: "docker-linux",
  instruction: "打开 https://example.test 并截图",
  title: "打开测试页并截图",
  status: "queued",
  createdAt: "2026-09-03T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
};

const node = (overrides: Partial<ExecutionNode>): ExecutionNode => ({
  id: "node-b",
  name: "Linux worker",
  platform: "linux",
  osVersion: "6.8.0",
  architecture: "x64",
  deviceClass: "server",
  isolation: "unknown",
  trustTier: "development",
  capabilities: ["browser", "shell", "screenshot"],
  capabilityManifest: [],
  activeRunIds: [],
  maxConcurrentRuns: 1,
  connectedAt: "2026-09-03T00:00:00.000Z",
  lastSeenAt: "2026-09-03T00:00:00.000Z",
  ...overrides,
});

describe("execution routing", () => {
  it("maps fixed profiles to explicit capability requirements", () => {
    expect(requirementsForRun(run)).toEqual({
      capabilities: ["browser", "screenshot"],
      executionProfile: "docker-linux",
    });
    expect(requirementsForRun({ ...run, executionProfile: "macos-cua" })).toEqual({
      capabilities: ["cua", "screenshot"],
      executionProfile: "macos-cua",
      platform: "macos",
    });
    expect(requirementsForRun({ ...run, executionProfile: "none" })).toBeUndefined();
  });

  it("selects the least-loaded compatible node with a stable ID tie-break", () => {
    const selected = selectExecutionNode(run, [
      node({ id: "node-b" }),
      node({ id: "node-a" }),
      node({ id: "node-full", activeRunIds: [run.id] }),
      node({ id: "node-shell", capabilities: ["shell"] }),
    ]);

    expect(selected?.node.id).toBe("node-a");
  });

  it("does not route macOS profiles to a capability-compatible Linux node", () => {
    const selected = selectExecutionNode({ ...run, executionProfile: "macos-cua" }, [
      node({ capabilities: ["cua", "screenshot"], platform: "linux" }),
    ]);
    expect(selected).toBeUndefined();
  });
});
