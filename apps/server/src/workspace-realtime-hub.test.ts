import type { WorkspaceRealtimeEvent } from "@openbot/domain";
import { describe, expect, it } from "vitest";
import { WorkspaceRealtimeHub } from "./workspace-realtime-hub.js";

describe("workspace realtime hub", () => {
  it("broadcasts Node projections and supports unsubscribe", () => {
    const hub = new WorkspaceRealtimeHub();
    const received: WorkspaceRealtimeEvent[] = [];
    const unsubscribe = hub.subscribe((event) => received.push(event));
    const node = {
      id: "linux-node",
      name: "Linux worker",
      platform: "linux" as const,
      osVersion: "6.8.0",
      architecture: "x64" as const,
      deviceClass: "server" as const,
      isolation: "unknown" as const,
      trustTier: "development" as const,
      capabilities: ["browser"],
      capabilityManifest: [],
      activeRunIds: [],
      maxConcurrentRuns: 1,
      connectedAt: "2026-09-04T00:00:00.000Z",
      lastSeenAt: "2026-09-04T00:00:00.000Z",
    };

    hub.publish({ type: "node.upserted", node });
    unsubscribe();
    hub.publish({
      type: "node.removed",
      nodeId: node.id,
      occurredAt: "2026-09-04T00:01:00.000Z",
    });

    expect(received).toEqual([{ type: "node.upserted", node }]);
  });
});
