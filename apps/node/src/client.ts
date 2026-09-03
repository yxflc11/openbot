import { hostname, platform } from "node:os";
import type { NodeEnv } from "@openbot/config";
import { type NodeMessage, protocolVersion, serverAckSchema } from "@openbot/protocol";
import WebSocket from "ws";
import { availableCapabilities } from "./providers.js";

const heartbeatIntervalMs = 10_000;
const reconnectDelayMs = 2_000;

export class OpenBotNodeClient {
  readonly #env: NodeEnv;
  #socket?: WebSocket;
  #heartbeat?: NodeJS.Timeout;
  #reconnect?: NodeJS.Timeout;
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
          activeRunIds: [],
          sentAt: new Date().toISOString(),
        };
        socket.send(JSON.stringify(heartbeat));
      }, heartbeatIntervalMs);
    });

    socket.on("message", (raw) => {
      const parsed = serverAckSchema.safeParse(parseJson(raw.toString()));
      if (!parsed.success || !parsed.data.accepted) {
        console.error(parsed.success ? parsed.data.reason : "Invalid server acknowledgement.");
      }
    });

    socket.on("close", () => {
      clearInterval(this.#heartbeat);
      if (!this.#stopped) {
        this.#reconnect = setTimeout(() => this.#connect(), reconnectDelayMs);
      }
    });

    socket.on("error", (error) => {
      console.warn(`Node connection failed: ${error.message}`);
    });
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
