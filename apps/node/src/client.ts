import { hostname, platform } from "node:os";
import type { NodeEnv } from "@openbot/config";
import {
  type NodeCapability,
  type NodeMessage,
  protocolVersion,
  type RunOffer,
  serverMessageSchema,
} from "@openbot/protocol";
import WebSocket from "ws";
import { availableCapabilities } from "./providers.js";

const heartbeatIntervalMs = 10_000;
const reconnectDelayMs = 2_000;

export class OpenBotNodeClient {
  readonly #env: NodeEnv;
  #socket?: WebSocket;
  #heartbeat?: NodeJS.Timeout;
  #reconnect?: NodeJS.Timeout;
  readonly #assignedRunIds = new Set<string>();
  #stopped = false;

  constructor(env: NodeEnv) {
    this.#env = env;
  }

  start(): void {
    this.#stopped = false;
    this.#connect();
  }

  stop(): void {
    this.#stopped = true;
    clearInterval(this.#heartbeat);
    clearTimeout(this.#reconnect);
    this.#assignedRunIds.clear();
    this.#socket?.close(1000, "node-shutdown");
  }

  #connect(): void {
    const socket = new WebSocket(this.#env.OPENBOT_NODE_SERVER_URL);
    this.#socket = socket;

    socket.on("open", () => {
      const currentPlatform = platform() === "darwin" ? "macos" : "linux";
      const hello: NodeMessage = {
        type: "node.hello",
        protocolVersion,
        nodeId: this.#env.OPENBOT_NODE_ID,
        name: hostname(),
        platform: currentPlatform,
        capabilities: availableCapabilities(),
        maxConcurrentRuns: this.#env.OPENBOT_NODE_MAX_CONCURRENT_RUNS,
        token: this.#env.OPENBOT_NODE_TOKEN,
        sentAt: new Date().toISOString(),
      };
      socket.send(JSON.stringify(hello));

      this.#heartbeat = setInterval(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }
        const heartbeat: NodeMessage = {
          type: "node.heartbeat",
          protocolVersion,
          nodeId: this.#env.OPENBOT_NODE_ID,
          activeRunIds: Array.from(this.#assignedRunIds),
          sentAt: new Date().toISOString(),
        };
        socket.send(JSON.stringify(heartbeat));
      }, heartbeatIntervalMs);
    });

    socket.on("message", (raw) => {
      const parsed = serverMessageSchema.safeParse(parseJson(raw.toString()));
      if (!parsed.success) {
        console.error("Invalid server protocol message.");
        return;
      }

      const message = parsed.data;
      if (message.type === "server.ack") {
        if (!message.accepted) console.error(message.reason ?? "Server rejected the node message.");
        return;
      }

      if (message.type === "run.offer") {
        const capabilities = availableCapabilities();
        const rejection = runOfferRejectionReason(
          message,
          capabilities,
          this.#assignedRunIds.size,
          this.#env.OPENBOT_NODE_MAX_CONCURRENT_RUNS,
        );
        const response: NodeMessage = rejection
          ? {
              type: "run.reject",
              protocolVersion,
              nodeId: this.#env.OPENBOT_NODE_ID,
              offerId: message.offerId,
              runId: message.runId,
              reason: rejection,
              rejectedAt: new Date().toISOString(),
            }
          : {
              type: "run.accept",
              protocolVersion,
              nodeId: this.#env.OPENBOT_NODE_ID,
              offerId: message.offerId,
              runId: message.runId,
              acceptedAt: new Date().toISOString(),
            };
        socket.send(JSON.stringify(response));
        return;
      }

      if (message.type === "run.assigned") {
        if (message.nodeId === this.#env.OPENBOT_NODE_ID) {
          this.#assignedRunIds.add(message.runId);
        }
        return;
      }

      this.#assignedRunIds.delete(message.runId);
    });

    socket.on("close", () => {
      clearInterval(this.#heartbeat);
      this.#assignedRunIds.clear();
      if (!this.#stopped) {
        this.#reconnect = setTimeout(() => this.#connect(), reconnectDelayMs);
      }
    });

    socket.on("error", (error) => {
      console.warn(`Node connection failed: ${error.message || error.name || "connection error"}`);
    });
  }
}

export function runOfferRejectionReason(
  offer: RunOffer,
  available: NodeCapability[],
  activeRuns: number,
  maxConcurrentRuns: number,
): string | undefined {
  if (activeRuns >= maxConcurrentRuns) return "Node is at capacity.";
  const capabilities = new Set(available);
  const missing = offer.requiredCapabilities.filter((capability) => !capabilities.has(capability));
  return missing.length === 0 ? undefined : `Missing capabilities: ${missing.join(", ")}.`;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
