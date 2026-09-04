import type { ExecutionNode, NodeIdentitySummary } from "@openbot/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NodeIdentityList, nodeIdentityDisplayState } from "./NodeManagerDialog";

const identity: NodeIdentitySummary = {
  nodeId: "office-linux-01",
  status: "active",
  connected: false,
  enrolledAt: "2026-09-04T00:00:00.000Z",
};

const node: ExecutionNode = {
  id: identity.nodeId,
  name: "Office Linux",
  status: "online",
  platform: "linux",
  osVersion: "6.8",
  architecture: "x64",
  deviceClass: "server",
  isolation: "container",
  trustTier: "dedicated",
  capabilities: ["browser"],
  capabilityManifest: [
    { id: "browser.navigate", version: 1, providerId: "browser-driver", constraints: {} },
  ],
  maxConcurrentRuns: 1,
  activeRunIds: [],
  connectedAt: "2026-09-04T00:00:00.000Z",
  lastSeenAt: "2026-09-04T00:01:00.000Z",
};

describe("NodeManagerDialog", () => {
  it("derives live state from the realtime Node projection and lets revocation win", () => {
    expect(nodeIdentityDisplayState(identity, [node])).toBe("online");
    expect(nodeIdentityDisplayState(identity, [])).toBe("offline");
    expect(nodeIdentityDisplayState({ ...identity, status: "revoked" }, [node])).toBe("revoked");
  });

  it("renders platform evidence and requires a second destructive action", () => {
    const html = renderToStaticMarkup(
      <NodeIdentityList
        identities={[identity]}
        onlineNodes={[node]}
        confirmingNodeId={identity.nodeId}
        onConfirm={() => undefined}
        onCancel={() => undefined}
        onRevoke={() => undefined}
      />,
    );

    expect(html).toContain("Office Linux");
    expect(html).toContain("Linux · x64");
    expect(html).toContain("在线");
    expect(html).toContain("旧凭证将立即失效");
    expect(html).toContain("确认吊销");
  });
});
