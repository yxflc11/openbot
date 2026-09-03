import { once } from "node:events";
import { createServer } from "node:http";
import { nodeEnvSchema } from "@openbot/config";
import type { ComputerProvider } from "@openbot/provider-sdk";
import {
  nodeMessageSchema,
  protocolVersion,
  type RunOffer,
  type ServerMessage,
} from "@openbot/protocol";
import { describe, expect, it } from "vitest";
import { type WebSocket, WebSocketServer } from "ws";
import { OpenBotNodeClient, runOfferRejectionReason } from "./client.js";

const offer: RunOffer = {
  type: "run.offer",
  protocolVersion,
  offerId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
  channelId: "00000000-0000-4000-8000-000000000003",
  botId: "00000000-0000-4000-8000-000000000004",
  title: "打开测试页并截图",
  instruction: "打开 https://example.test 并截图",
  executionProfile: "docker-linux",
  requiredCapabilities: ["browser", "screenshot"],
  sentAt: "2026-09-03T00:00:00.000Z",
};

describe("node run offers", () => {
  it("accepts only offers covered by local capabilities and capacity", () => {
    expect(runOfferRejectionReason(offer, ["browser", "screenshot"], 0, 1)).toBeUndefined();
    expect(runOfferRejectionReason(offer, ["browser"], 0, 1)).toBe(
      "Missing capabilities: screenshot.",
    );
    expect(runOfferRejectionReason(offer, ["browser", "screenshot"], 1, 1)).toBe(
      "Node is at capacity.",
    );
  });

  it("executes an assigned run and reports progress and completion", async () => {
    const server = createServer();
    const gateway = new WebSocketServer({ server });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test port.");

    const receivedTypes: string[] = [];
    let advertisedCapabilities: string[] = [];
    let advertisedManifest: string[] = [];
    let resolveCompletion: (() => void) | undefined;
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    const provider: ComputerProvider = {
      id: "docker",
      displayName: "Test computer",
      platforms: ["linux", "macos"],
      capabilities: ["browser", "screenshot"],
      capabilityManifest: [
        { id: "browser.observe", version: 1, providerId: "docker", constraints: {} },
        { id: "screen.capture", version: 1, providerId: "docker", constraints: {} },
      ],
      async execute(_context, input, reportProgress, reportFrame, requestApproval) {
        expect(input.instruction).toBe(offer.instruction);
        reportProgress({ stage: "navigate", message: "Opening test page" });
        reportFrame?.({
          mediaType: "image/png",
          base64: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString(
            "base64",
          ),
          width: 1280,
          height: 800,
          capturedAt: "2026-09-03T00:00:00.000Z",
        });
        expect(requestApproval).toBeDefined();
        const approval = await requestApproval?.({
          actionId: "prepared-action-1",
          action: "form.submit",
          target: "https://example.test/form#signup",
          summary: "Submit the test form",
          risk: "write",
          beforeState: { fields: 3 },
        });
        expect(approval?.status).toBe("approved");
        return { ok: true, summary: "Page opened and captured", artifacts: [] };
      },
    };
    const client = new OpenBotNodeClient(
      nodeEnvSchema.parse({
        OPENBOT_NODE_ID: "test-node",
        OPENBOT_NODE_SERVER_URL: `ws://127.0.0.1:${address.port}`,
        OPENBOT_NODE_TOKEN: "test-node-token",
      }),
      [provider],
    );

    gateway.on("connection", (socket) => {
      socket.on("message", (raw) => {
        const parsed = nodeMessageSchema.safeParse(JSON.parse(raw.toString()));
        if (!parsed.success) return;
        const message = parsed.data;
        receivedTypes.push(message.type);

        if (message.type === "node.hello") {
          advertisedCapabilities = message.capabilities;
          advertisedManifest = message.capabilityManifest.map(
            (capability) => `${capability.id}@${capability.version}`,
          );
          send(socket, {
            type: "server.ack",
            protocolVersion,
            accepted: true,
            receivedAt: new Date().toISOString(),
          });
          send(socket, offer);
        }
        if (message.type === "run.accept") {
          send(socket, {
            type: "run.assigned",
            protocolVersion,
            runId: message.runId,
            nodeId: message.nodeId,
            assignedAt: new Date().toISOString(),
          });
        }
        if (message.type === "run.start_request") {
          send(socket, {
            type: "run.start",
            protocolVersion,
            runId: message.runId,
            nodeId: message.nodeId,
            startedAt: new Date().toISOString(),
          });
        }
        if (message.type === "approval.request") {
          send(socket, {
            type: "approval.resolved",
            protocolVersion,
            nodeId: message.nodeId,
            runId: message.runId,
            requestId: message.requestId,
            decision: "approved",
            decidedAt: new Date().toISOString(),
          });
        }
        if (message.type === "run.completed") {
          send(socket, {
            type: "run.settled",
            protocolVersion,
            runId: message.runId,
            nodeId: message.nodeId,
            status: "completed",
            settledAt: new Date().toISOString(),
          });
          resolveCompletion?.();
        }
      });
    });

    try {
      client.start();
      await withTimeout(completion);

      expect(advertisedCapabilities).toEqual(["browser", "screenshot"]);
      expect(advertisedManifest).toEqual(["browser.observe@1", "screen.capture@1"]);
      expect(receivedTypes).toEqual([
        "node.hello",
        "run.accept",
        "run.start_request",
        "run.progress",
        "run.frame",
        "approval.request",
        "run.completed",
      ]);
    } finally {
      client.stop();
      for (const socket of gateway.clients) socket.terminate();
      await new Promise<void>((resolve) => gateway.close(() => resolve()));
      server.close();
      await once(server, "close");
    }
  });
});

function send(socket: WebSocket, message: ServerMessage): void {
  socket.send(JSON.stringify(message));
}

async function withTimeout(promise: Promise<void>, timeoutMs = 1000): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Timed out waiting for Node execution.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
