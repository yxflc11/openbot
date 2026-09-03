import { randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import type { ExecutionNode } from "@openbot/domain";
import {
  type NodeCapability,
  type NodeMessage,
  nodeMessageSchema,
  protocolVersion,
  type RunOffer,
  type ServerAck,
  type ServerMessage,
} from "@openbot/protocol";
import { type RawData, WebSocket, WebSocketServer } from "ws";

interface ConnectedNode extends ExecutionNode {
  socket: WebSocket;
}

interface PendingOffer {
  nodeId: string;
  runId: string;
  resolve(result: RunOfferResult): void;
  timeout: NodeJS.Timeout;
}

export interface RunOfferInput {
  runId: string;
  channelId: string;
  botId: string;
  title: string;
  instruction: string;
  executionProfile: RunOffer["executionProfile"];
  requiredCapabilities: NodeCapability[];
}

export type RunOfferResult =
  | { status: "accepted" }
  | { status: "rejected"; reason: string }
  | { status: "unavailable"; reason: string }
  | { status: "timeout" };

type NodeHandler = (node: ExecutionNode) => void;
export type NodeRunMessage = Extract<
  NodeMessage,
  {
    type:
      | "run.start_request"
      | "run.progress"
      | "run.frame"
      | "approval.request"
      | "run.completed"
      | "run.failed";
  }
>;
type NodeRunHandler = (node: ExecutionNode, message: NodeRunMessage) => void;

export class NodeRegistry {
  readonly #nodes = new Map<string, ConnectedNode>();
  readonly #enrollmentToken: string;
  readonly #offerTimeoutMs: number;
  readonly #availableHandlers = new Set<NodeHandler>();
  readonly #updatedHandlers = new Set<NodeHandler>();
  readonly #unavailableHandlers = new Set<NodeHandler>();
  readonly #runHandlers = new Set<NodeRunHandler>();
  readonly #pendingOffers = new Map<string, PendingOffer>();
  #gateway?: WebSocketServer;

  constructor(enrollmentToken: string, options: { offerTimeoutMs?: number } = {}) {
    this.#enrollmentToken = enrollmentToken;
    this.#offerTimeoutMs = options.offerTimeoutMs ?? 10_000;
  }

  list(): ExecutionNode[] {
    return Array.from(this.#nodes.values(), ({ socket: _socket, ...node }) => node);
  }

  onAvailable(handler: NodeHandler): () => void {
    this.#availableHandlers.add(handler);
    return () => this.#availableHandlers.delete(handler);
  }

  onUnavailable(handler: NodeHandler): () => void {
    this.#unavailableHandlers.add(handler);
    return () => this.#unavailableHandlers.delete(handler);
  }

  onUpdated(handler: NodeHandler): () => void {
    this.#updatedHandlers.add(handler);
    return () => this.#updatedHandlers.delete(handler);
  }

  onRunMessage(handler: NodeRunHandler): () => void {
    this.#runHandlers.add(handler);
    return () => this.#runHandlers.delete(handler);
  }

  async offerRun(nodeId: string, input: RunOfferInput): Promise<RunOfferResult> {
    const node = this.#nodes.get(nodeId);
    if (node === undefined || node.socket.readyState !== WebSocket.OPEN) {
      return { status: "unavailable", reason: "Node is not connected." };
    }
    if (node.activeRunIds.length + this.#pendingOfferCount(nodeId) >= node.maxConcurrentRuns) {
      return { status: "unavailable", reason: "Node is at capacity." };
    }

    const offer: RunOffer = {
      type: "run.offer",
      protocolVersion,
      offerId: randomUUID(),
      ...input,
      sentAt: new Date().toISOString(),
    };

    return new Promise((resolve) => {
      const settle = (result: RunOfferResult) => {
        const pending = this.#pendingOffers.get(offer.offerId);
        if (pending === undefined) return;
        clearTimeout(pending.timeout);
        this.#pendingOffers.delete(offer.offerId);
        resolve(result);
      };
      const timeout = setTimeout(() => settle({ status: "timeout" }), this.#offerTimeoutMs);
      this.#pendingOffers.set(offer.offerId, {
        nodeId,
        runId: input.runId,
        resolve: settle,
        timeout,
      });
      try {
        node.socket.send(JSON.stringify(offer), (error) => {
          if (error) {
            settle({
              status: "unavailable",
              reason: `Run offer could not be delivered: ${error.message}`,
            });
          }
        });
      } catch {
        settle({ status: "unavailable", reason: "Run offer could not be delivered." });
      }
    });
  }

  confirmRun(nodeId: string, runId: string): boolean {
    const node = this.#nodes.get(nodeId);
    if (node === undefined || node.socket.readyState !== WebSocket.OPEN) return false;
    const message: ServerMessage = {
      type: "run.assigned",
      protocolVersion,
      runId,
      nodeId,
      assignedAt: new Date().toISOString(),
    };
    try {
      node.socket.send(JSON.stringify(message));
      if (!node.activeRunIds.includes(runId)) {
        node.activeRunIds.push(runId);
        this.#emit(this.#updatedHandlers, node);
      }
      return true;
    } catch {
      return false;
    }
  }

  startRun(nodeId: string, runId: string): boolean {
    const node = this.#nodes.get(nodeId);
    if (
      node === undefined ||
      node.socket.readyState !== WebSocket.OPEN ||
      !node.activeRunIds.includes(runId)
    ) {
      return false;
    }
    const message: ServerMessage = {
      type: "run.start",
      protocolVersion,
      runId,
      nodeId,
      startedAt: new Date().toISOString(),
    };
    try {
      node.socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  resolveApproval(
    nodeId: string,
    runId: string,
    requestId: string,
    decision: "approved" | "rejected" | "expired",
  ): boolean {
    const node = this.#nodes.get(nodeId);
    if (
      node === undefined ||
      node.socket.readyState !== WebSocket.OPEN ||
      !node.activeRunIds.includes(runId)
    ) {
      return false;
    }
    const message: ServerMessage = {
      type: "approval.resolved",
      protocolVersion,
      nodeId,
      runId,
      requestId,
      decision,
      decidedAt: new Date().toISOString(),
    };
    try {
      node.socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  settleRun(nodeId: string, runId: string, status: "completed" | "failed"): void {
    const node = this.#nodes.get(nodeId);
    if (node === undefined) return;
    const activeRunIds = node.activeRunIds.filter((id) => id !== runId);
    if (activeRunIds.length !== node.activeRunIds.length) {
      node.activeRunIds = activeRunIds;
      this.#emit(this.#updatedHandlers, node);
    }
    if (node.socket.readyState !== WebSocket.OPEN) return;
    const message: ServerMessage = {
      type: "run.settled",
      protocolVersion,
      runId,
      nodeId,
      status,
      settledAt: new Date().toISOString(),
    };
    try {
      node.socket.send(JSON.stringify(message));
    } catch {
      // Heartbeat or disconnect reconciliation repairs the in-memory capacity projection.
    }
  }

  cancelRun(nodeId: string, runId: string, reason: string): void {
    const node = this.#nodes.get(nodeId);
    if (node === undefined) return;
    const activeRunIds = node.activeRunIds.filter((id) => id !== runId);
    if (activeRunIds.length !== node.activeRunIds.length) {
      node.activeRunIds = activeRunIds;
      this.#emit(this.#updatedHandlers, node);
    }
    if (node.socket.readyState !== WebSocket.OPEN) return;
    const message: ServerMessage = {
      type: "run.cancel",
      protocolVersion,
      runId,
      reason,
      cancelledAt: new Date().toISOString(),
    };
    try {
      node.socket.send(JSON.stringify(message));
    } catch {
      // Disconnect reconciliation repairs any assignment that lost its transport.
    }
  }

  attach(server: HttpServer): void {
    const gateway = new WebSocketServer({ noServer: true });
    this.#gateway = gateway;

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
        const parsed = nodeMessageSchema.safeParse(parseJson(raw.toString()));

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
          if (enrolledNodeId !== undefined && enrolledNodeId !== message.nodeId) {
            sendAck(socket, false, "A connection cannot change its Node identity.");
            socket.close(1008, "identity-changed");
            return;
          }

          enrolledNodeId = message.nodeId;
          const previous = this.#nodes.get(message.nodeId);
          if (previous !== undefined && previous.socket !== socket) {
            this.#disconnectNode(previous, "Node reconnected with a new socket.", false);
            previous.socket.terminate();
          }

          const node: ConnectedNode = {
            id: message.nodeId,
            name: message.name,
            platform: message.platform,
            osVersion: message.osVersion,
            architecture: message.architecture,
            deviceClass: message.deviceClass,
            isolation: message.isolation,
            trustTier: message.trustTier,
            capabilities: message.capabilities,
            capabilityManifest: message.capabilityManifest,
            activeRunIds: [],
            maxConcurrentRuns: message.maxConcurrentRuns,
            connectedAt: now,
            lastSeenAt: now,
            socket,
          };
          this.#nodes.set(message.nodeId, node);
          sendAck(socket, true);
          this.#emit(this.#availableHandlers, node);
          return;
        }

        const node = enrolledNodeId === undefined ? undefined : this.#nodes.get(enrolledNodeId);
        if (node === undefined || node.socket !== socket || enrolledNodeId !== message.nodeId) {
          sendAck(socket, false, "Node must enroll before sending runtime messages.");
          socket.close(1008, "not-enrolled");
          return;
        }

        node.lastSeenAt = now;
        if (message.type === "node.heartbeat") {
          node.activeRunIds = message.activeRunIds.slice(0, node.maxConcurrentRuns);
          this.#emit(this.#updatedHandlers, node);
          sendAck(socket, true);
          return;
        }

        if (
          message.type === "run.start_request" ||
          message.type === "run.progress" ||
          message.type === "run.frame" ||
          message.type === "approval.request" ||
          message.type === "run.completed" ||
          message.type === "run.failed"
        ) {
          if (!node.activeRunIds.includes(message.runId)) {
            sendAck(socket, false, "Run is not assigned to this Node connection.");
            return;
          }
          this.#emitRun(node, message);
          sendAck(socket, true);
          return;
        }

        const pending = this.#pendingOffers.get(message.offerId);
        if (
          pending === undefined ||
          pending.nodeId !== node.id ||
          pending.runId !== message.runId
        ) {
          sendAck(socket, false, "Run offer response does not match an active offer.");
          socket.close(1008, "invalid-offer-response");
          return;
        }

        if (message.type === "run.accept") {
          pending.resolve({ status: "accepted" });
        } else {
          pending.resolve({ status: "rejected", reason: message.reason });
        }
        sendAck(socket, true);
      });

      socket.on("close", () => {
        if (enrolledNodeId === undefined) return;
        const node = this.#nodes.get(enrolledNodeId);
        if (node !== undefined && node.socket === socket) {
          this.#disconnectNode(node, "Node disconnected before accepting the run.");
        }
      });
    });
  }

  close(): void {
    for (const pending of this.#pendingOffers.values()) {
      pending.resolve({ status: "unavailable", reason: "Node gateway is shutting down." });
    }
    for (const socket of this.#gateway?.clients ?? []) socket.terminate();
    this.#gateway?.close();
    this.#nodes.clear();
  }

  #disconnectNode(node: ConnectedNode, reason: string, emitUnavailable = true): void {
    if (this.#nodes.get(node.id)?.socket === node.socket) this.#nodes.delete(node.id);
    for (const pending of Array.from(this.#pendingOffers.values())) {
      if (pending.nodeId === node.id) pending.resolve({ status: "unavailable", reason });
    }
    if (emitUnavailable) this.#emit(this.#unavailableHandlers, node);
  }

  #pendingOfferCount(nodeId: string): number {
    let count = 0;
    for (const pending of this.#pendingOffers.values()) {
      if (pending.nodeId === nodeId) count += 1;
    }
    return count;
  }

  #emit(handlers: Set<NodeHandler>, node: ConnectedNode): void {
    const { socket: _socket, ...snapshot } = node;
    for (const handler of handlers) handler(snapshot);
  }

  #emitRun(node: ConnectedNode, message: NodeRunMessage): void {
    const { socket: _socket, ...snapshot } = node;
    for (const handler of this.#runHandlers) handler(snapshot, message);
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
