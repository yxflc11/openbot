import type { Run } from "@openbot/domain";
import { describe, expect, it } from "vitest";
import {
  indexActiveRunsByBot,
  isActiveRun,
  mergeRuns,
  projectRunOnNodes,
  runStatusLabel,
} from "./run-state";

function run(overrides: Partial<Run> = {}): Run {
  return {
    id: "run-1",
    channelId: "channel-1",
    botId: "bot-1",
    executionProfile: "docker-linux",
    title: "Test task",
    status: "queued",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("run projections", () => {
  it("deduplicates realtime updates and keeps newest runs first", () => {
    const older = run();
    const updated = run({ status: "running", updatedAt: "2026-01-01T00:01:00.000Z" });
    const newer = run({
      id: "run-2",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    expect(mergeRuns([older], [updated, newer])).toEqual([newer, updated]);
  });

  it("does not let an older REST response overwrite a newer realtime state", () => {
    const assigned = run({
      status: "assigned",
      nodeId: "linux-node",
      updatedAt: "2026-01-01T00:01:00.000Z",
    });
    const staleQueued = run({ status: "queued", updatedAt: "2026-01-01T00:00:00.000Z" });

    expect(mergeRuns([assigned], [staleQueued])).toEqual([assigned]);
    expect(mergeRuns([assigned], [{ ...staleQueued, updatedAt: assigned.updatedAt }])).toEqual([
      assigned,
    ]);
  });

  it("indexes only the newest active run for each Bot", () => {
    const active = run({ id: "active", status: "waiting_approval" });
    const completed = run({ id: "done", status: "completed" });
    const index = indexActiveRunsByBot([active, completed]);

    expect(index.get("bot-1")).toEqual(active);
    expect(isActiveRun(completed)).toBe(false);
    expect(runStatusLabel(active.status)).toBe("待批准");
    expect(runStatusLabel("assigned")).toBe("已分配");
  });

  it("projects assignment and requeue events onto the connected Node", () => {
    const nodes = [
      {
        id: "linux-node",
        name: "Linux worker",
        platform: "linux" as const,
        capabilities: ["browser"],
        activeRunIds: [],
        maxConcurrentRuns: 1,
        connectedAt: "2026-01-01T00:00:00.000Z",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const queued = run();
    const assigned = run({ nodeId: "linux-node", status: "assigned" });
    const withAssignment = projectRunOnNodes(nodes, queued, assigned);
    const requeued = projectRunOnNodes(withAssignment, assigned, queued);

    expect(withAssignment[0]?.activeRunIds).toEqual([queued.id]);
    expect(requeued[0]?.activeRunIds).toEqual([]);
  });
});
