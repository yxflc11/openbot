import { createServer } from "node:http";
import { once } from "node:events";
import { protocolVersion, serverMessageSchema, type ServerMessage } from "@openbot/protocol";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { isEnrollmentTokenValid, NodeRegistry } from "./node-registry.js";

describe("node enrollment", () => {
  it("accepts only an exact token match", () => {
    expect(isEnrollmentTokenValid("foundation-token", "foundation-token")).toBe(true);
    expect(isEnrollmentTokenValid("wrong-token", "foundation-token")).toBe(false);
    expect(isEnrollmentTokenValid("short", "foundation-token")).toBe(false);
  });

  it("delivers a run offer and confirms assignment over the outbound Node socket", async () => {
    const server = createServer();
    const registry = new NodeRegistry("foundation-token", { offerTimeoutMs: 500 });
    registry.attach(server);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test port.");

    const client = new WebSocket(`ws://127.0.0.1:${address.port}/ws/nodes`);
    const received: ServerMessage[] = [];
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
        executionProfile: "docker-linux",
        requiredCapabilities: ["browser", "screenshot"],
      });
      expect(result).toEqual({ status: "accepted" });
      expect(registry.confirmRun("linux-node", runId)).toBe(true);
      await waitFor(() => received.some((message) => message.type === "run.assigned"));
      expect(registry.list()[0]?.activeRunIds).toEqual([runId]);
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
