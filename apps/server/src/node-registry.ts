import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { timingSafeEqual } from "node:crypto";
import type { ExecutionNode } from "@openbot/domain";
import { nodeMessageSchema, protocolVersion, type ServerAck } from "@openbot/protocol";
import { type RawData, type WebSocket, WebSocketServer } from "ws";

interface ConnectedNode extends ExecutionNode {
  socket: WebSocket;
}

export class NodeRegistry {
  readonly #nodes = new Map<string, ConnectedNode>();
  readonly #enrollmentToken: string;

  constructor(enrollmentToken: string) {
    this.#enrollmentToken = enrollmentToken;
  }

  list(): ExecutionNode[] {
    return Array.from(this.#nodes.values(), ({ socket: _socket, ...node }) => node);
  }

  attach(server: HttpServer): void {
    const gateway = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(request.url ?? "/", "http://openbot.local");
      if (url.pathname !== "/ws/nodes") {
        socket.destroy();
        return;
      }

      gateway.handleUpgrade(request, socket, head, (webSocket) => {
        gateway.emit("connection", webSocket, request);
      });
    });

    gateway.on("connection", (socket) => {
      let enrolledNodeId: string | undefined;

      socket.on("message", (raw: RawData) => {
        const parsedJson = parseJson(raw.toString());
        const parsed = nodeMessageSchema.safeParse(parsedJson);

        if (!parsed.success) {
          sendAck(socket, false, "Invalid node protocol message.");
          socket.close(1008, "invalid-message");
          return;
        }

        const message = parsed.data;
        const now = new Date().toISOString();

        if (message.type === "node.hello") {
          if (!isEnrollmentTokenValid(message.token, this.#enrollmentToken)) {
            sendAck(socket, false, "Invalid enrollment token.");
            socket.close(1008, "invalid-token");
            return;
          }

          enrolledNodeId = message.nodeId;
          this.#nodes.set(message.nodeId, {
            id: message.nodeId,
            name: message.name,
            platform: message.platform,
            capabilities: message.capabilities,
            connectedAt: now,
            lastSeenAt: now,
            socket,
          });
          sendAck(socket, true);
          return;
        }

        const node = this.#nodes.get(message.nodeId);
        if (node === undefined || enrolledNodeId !== message.nodeId) {
          sendAck(socket, false, "Node must enroll before sending heartbeats.");
          socket.close(1008, "not-enrolled");
          return;
        }

        node.lastSeenAt = now;
        sendAck(socket, true);
      });

      socket.on("close", () => {
        if (enrolledNodeId !== undefined) {
          this.#nodes.delete(enrolledNodeId);
        }
      });
    });
  }
}

export function isEnrollmentTokenValid(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function sendAck(socket: WebSocket, accepted: boolean, reason?: string): void {
  const message: ServerAck = {
    type: "server.ack",
    protocolVersion,
    accepted,
    receivedAt: new Date().toISOString(),
    ...(reason === undefined ? {} : { reason }),
  };
  socket.send(JSON.stringify(message));
}
