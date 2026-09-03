import { createServer } from "node:http";
import { once } from "node:events";
import { protocolVersion, serverMessageSchema, type ServerMessage } from "@openbot/protocol";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { isEnrollmentTokenValid, NodeRegistry, type NodeRunMessage } from "./node-registry.js";

describe("node enrollment", () => {
  it("accepts only an exact token match", () => {
    expect(isEnrollmentTokenValid("foundation-token", "foundation-token")).toBe(true);
    expect(isEnrollmentTokenValid("wrong-token", "foundation-token")).toBe(false);
    expect(isEnrollmentTokenValid("short", "foundation-token")).toBe(false);
  });

  it("carries assignment and execution lifecycle over the outbound Node socket", async () => {
    const server = createServer();
    const registry = new NodeRegistry("foundation-token", { offerTimeoutMs: 500 });
    registry.attach(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test port.");

    const client = new WebSocket(`ws://127.0.0.1:${address.port}/ws/nodes`);
    const received: ServerMessage[] = [];
    const runtimeMessages: NodeRunMessage[] = [];
    const nodeUpdates: string[][] = [];
    registry.onRunMessage((_node, message) => runtimeMessages.push(message));
    registry.onUpdated((node) => nodeUpdates.push(node.activeRunIds));
    client.on("message", (raw) => {
      const parsed = serverMessageSchema.safeParse(JSON.parse(raw.toString()));
      if (!parsed.success) return;
      received.push(parsed.data);
      if (parsed.data.type === "run.offer") {
        client.send(
          JSON.stringify({
            type: "run.accept",
            protocolVersion,
            nodeId: "linux-node",
            offerId: parsed.data.offerId,
            runId: parsed.data.runId,
            acceptedAt: new Date().toISOString(),
          }),
        );
      }
      if (parsed.data.type === "run.assigned") {
        client.send(
          JSON.stringify({
            type: "run.start_request",
            protocolVersion,
            nodeId: "linux-node",
            runId: parsed.data.runId,
            requestedAt: new Date().toISOString(),
          }),
        );
      }
      if (parsed.data.type === "run.start") {
        client.send(
          JSON.stringify({
            type: "run.completed",
            protocolVersion,
            nodeId: "linux-node",
            runId: parsed.data.runId,
            summary: "已打开页面并截图",
            artifacts: [],
            completedAt: new Date().toISOString(),
          }),
        );
      }
    });

    try {
      await once(client, "open");
      client.send(
        JSON.stringify({
          type: "node.hello",
          protocolVersion,
          nodeId: "linux-node",
          name: "Linux worker",
          platform: "linux",
          capabilities: ["browser", "shell", "screenshot"],
          maxConcurrentRuns: 1,
          token: "foundation-token",
          sentAt: new Date().toISOString(),
        }),
      );
      await waitFor(() => registry.list().length === 1);

      const runId = "00000000-0000-4000-8000-000000000001";
      const result = await registry.offerRun("linux-node", {
        runId,
        channelId: "00000000-0000-4000-8000-000000000002",
        botId: "00000000-0000-4000-8000-000000000003",
        title: "打开测试页并截图",
        instruction: "打开 https://example.test 并截图",
        executionProfile: "docker-linux",
        requiredCapabilities: ["browser", "screenshot"],
      });
      expect(result).toEqual({ status: "accepted" });
      expect(registry.confirmRun("linux-node", runId)).toBe(true);
      await waitFor(() => received.some((message) => message.type === "run.assigned"));
      expect(registry.list()[0]?.activeRunIds).toEqual([runId]);
      expect(nodeUpdates.at(-1)).toEqual([runId]);
      await waitFor(() => runtimeMessages.some((message) => message.type === "run.start_request"));
      expect(registry.startRun("linux-node", runId)).toBe(true);
      await waitFor(() => runtimeMessages.some((message) => message.type === "run.completed"));
      registry.settleRun("linux-node", runId, "completed");
      await waitFor(() => received.some((message) => message.type === "run.settled"));
      expect(registry.list()[0]?.activeRunIds).toEqual([]);
      expect(nodeUpdates.at(-1)).toEqual([]);
    } finally {
      client.close();
      await once(client, "close");
      registry.close();
      server.close();
      await once(server, "close");
    }
  });
});

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for Node gateway state.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
