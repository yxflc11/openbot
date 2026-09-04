import { once } from "node:events";
import { createServer } from "node:http";
import { nodeEnvSchema } from "@openbot/config";
import {
  nodeMessageSchema,
  protocolVersion,
  type RunOffer,
  type ServerMessage,
} from "@openbot/protocol";
import type { ComputerProvider } from "@openbot/provider-sdk";
import { describe, expect, it } from "vitest";
import { type WebSocket, WebSocketServer } from "ws";
import { OpenBotNodeClient, runOfferRejectionReason } from "./client.js";
import type { NodeCredentialStore } from "./credential-store.js";

const nodeCredential = `obn_${"a".repeat(43)}`;
const enrollmentToken = `obenr_${"b".repeat(43)}`;

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
  requiredCapabilityManifest: [
    { id: "browser.observe", version: 1 },
    { id: "screen.capture", version: 1 },
  ],
  sentAt: "2026-09-03T00:00:00.000Z",
};

const capabilityManifest = [
  { id: "browser.observe" as const, version: 1, providerId: "docker", constraints: {} },
  { id: "screen.capture" as const, version: 1, providerId: "docker", constraints: {} },
];

describe("node run offers", () => {
  it("accepts only offers covered by local capabilities and capacity", () => {
    expect(
      runOfferRejectionReason(offer, ["browser", "screenshot"], capabilityManifest, 0, 1),
    ).toBeUndefined();
    expect(runOfferRejectionReason(offer, ["browser"], capabilityManifest, 0, 1)).toBe(
      "Missing legacy capabilities: screenshot.",
    );
    expect(
      runOfferRejectionReason(offer, ["browser", "screenshot"], capabilityManifest, 1, 1),
    ).toBe("Node is at capacity.");
    expect(
      runOfferRejectionReason(
        offer,
        ["browser", "screenshot"],
        capabilityManifest.map((item) =>
          item.id === "browser.observe" ? { ...item, version: 2 } : item,
        ),
        0,
        1,
      ),
    ).toBe("Unsupported capability version: browser.observe@1; advertised 2.");
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
        OPENBOT_NODE_CREDENTIAL: nodeCredential,
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

  it("exchanges a one-time token and persists the credential before connecting", async () => {
    let enrollmentBody: unknown;
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      enrollmentBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      response.writeHead(201, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          format: "openbot.node-identity/v1",
          nodeId: "fresh-node",
          credential: nodeCredential,
          enrolledAt: "2026-09-04T00:00:00.000Z",
        }),
      );
    });
    const gateway = new WebSocketServer({ server });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Missing test port.");

    let savedCredential: string | undefined;
    const credentialStore: NodeCredentialStore = {
      async load() {
        return undefined;
      },
      async save(identity) {
        savedCredential = identity.credential;
      },
    };
    let resolveHello: (() => void) | undefined;
    const helloReceived = new Promise<void>((resolve) => {
      resolveHello = resolve;
    });
    gateway.on("connection", (socket) => {
      socket.once("message", (raw) => {
        const parsed = nodeMessageSchema.parse(JSON.parse(raw.toString()));
        expect(parsed).toMatchObject({
          type: "node.hello",
          nodeId: "fresh-node",
          credential: nodeCredential,
        });
        expect(savedCredential).toBe(nodeCredential);
        send(socket, {
          type: "server.ack",
          protocolVersion,
          accepted: true,
          receivedAt: new Date().toISOString(),
        });
        resolveHello?.();
      });
    });
    const client = new OpenBotNodeClient(
      nodeEnvSchema.parse({
        OPENBOT_NODE_ID: "fresh-node",
        OPENBOT_NODE_SERVER_URL: `ws://127.0.0.1:${address.port}/ws/nodes`,
        OPENBOT_NODE_ENROLLMENT_TOKEN: enrollmentToken,
      }),
      [],
      credentialStore,
    );

    try {
      client.start();
      await withTimeout(helloReceived);
      expect(enrollmentBody).toEqual({ nodeId: "fresh-node", token: enrollmentToken });
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
