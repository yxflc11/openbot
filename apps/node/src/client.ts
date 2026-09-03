import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import type { NodeEnv } from "@openbot/config";
import {
  type ApprovalOutcome,
  assertProviderDeclarations,
  type ComputerProvider,
  type PreparedAction,
} from "@openbot/provider-sdk";
import {
  approvalRequestSchema,
  firstCapabilityRequirementMismatch,
  type NodeCapability,
  type NodeCapabilityDescriptor,
  type NodeMessage,
  protocolVersion,
  runFrameSchema,
  type RunOffer,
  serverMessageSchema,
} from "@openbot/protocol";
import WebSocket from "ws";
import { detectWorkerHost } from "./host.js";
import {
  availableCapabilities,
  availableCapabilityManifest,
  configuredProviders,
  providerForProfile,
} from "./providers.js";

const heartbeatIntervalMs = 10_000;
const reconnectDelayMs = 2_000;

export class OpenBotNodeClient {
  readonly #env: NodeEnv;
  readonly #providers: ComputerProvider[];
  #socket?: WebSocket;
  #heartbeat?: NodeJS.Timeout;
  #reconnect?: NodeJS.Timeout;
  readonly #assignedRunIds = new Set<string>();
  readonly #acceptedOffers = new Map<string, RunOffer>();
  readonly #executions = new Map<string, AbortController>();
  readonly #approvalWaiters = new Map<
    string,
    {
      runId: string;
      resolve(outcome: ApprovalOutcome): void;
      reject(error: Error): void;
      timer: NodeJS.Timeout;
    }
  >();
  #stopped = false;

  constructor(env: NodeEnv, providers = configuredProviders(env)) {
    this.#env = env;
    assertProviderDeclarations(providers);
    this.#providers = providers;
  }

  start(): void {
    this.#stopped = false;
    this.#connect();
  }

  stop(): void {
    this.#stopped = true;
    clearInterval(this.#heartbeat);
    clearTimeout(this.#reconnect);
    this.#abortExecutions();
    this.#assignedRunIds.clear();
    this.#acceptedOffers.clear();
    this.#socket?.close(1000, "node-shutdown");
  }

  #connect(): void {
    const socket = new WebSocket(this.#env.OPENBOT_NODE_SERVER_URL);
    this.#socket = socket;

    socket.on("open", () => {
      const host = detectWorkerHost();
      const hello: NodeMessage = {
        type: "node.hello",
        protocolVersion,
        nodeId: this.#env.OPENBOT_NODE_ID,
        name: hostname(),
        ...host,
        capabilities: availableCapabilities(this.#providers),
        capabilityManifest: availableCapabilityManifest(this.#providers),
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
        const capabilities = availableCapabilities(this.#providers);
        const capabilityManifest = availableCapabilityManifest(this.#providers);
        const rejection = runOfferRejectionReason(
          message,
          capabilities,
          capabilityManifest,
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
        if (rejection === undefined) this.#acceptedOffers.set(message.runId, message);
        socket.send(JSON.stringify(response));
        return;
      }

      if (message.type === "run.assigned") {
        if (
          message.nodeId === this.#env.OPENBOT_NODE_ID &&
          this.#acceptedOffers.has(message.runId)
        ) {
          this.#assignedRunIds.add(message.runId);
          this.#send({
            type: "run.start_request",
            protocolVersion,
            nodeId: this.#env.OPENBOT_NODE_ID,
            runId: message.runId,
            requestedAt: new Date().toISOString(),
          });
        }
        return;
      }

      if (message.type === "run.start") {
        if (message.nodeId === this.#env.OPENBOT_NODE_ID) void this.#executeRun(message.runId);
        return;
      }

      if (message.type === "approval.resolved") {
        const waiter = this.#approvalWaiters.get(message.requestId);
        if (waiter === undefined || waiter.runId !== message.runId) return;
        clearTimeout(waiter.timer);
        this.#approvalWaiters.delete(message.requestId);
        waiter.resolve({ approvalId: message.requestId, status: message.decision });
        return;
      }

      if (message.type === "run.cancel") this.#executions.get(message.runId)?.abort();
      this.#releaseRun(message.runId);
    });

    socket.on("close", () => {
      clearInterval(this.#heartbeat);
      this.#abortExecutions();
      this.#assignedRunIds.clear();
      this.#acceptedOffers.clear();
      if (!this.#stopped) {
        this.#reconnect = setTimeout(() => this.#connect(), reconnectDelayMs);
      }
    });

    socket.on("error", (error) => {
      console.warn(`Node connection failed: ${error.message || error.name || "connection error"}`);
    });
  }

  async #executeRun(runId: string): Promise<void> {
    if (this.#executions.has(runId)) return;
    const offer = this.#acceptedOffers.get(runId);
    if (offer === undefined) return;
    const provider = providerForProfile(this.#providers, offer.executionProfile);
    if (provider?.execute === undefined) {
      this.#sendFailure(
        runId,
        `No executable provider is configured for ${offer.executionProfile}.`,
      );
      return;
    }

    const controller = new AbortController();
    this.#executions.set(runId, controller);
    try {
      const result = await provider.execute(
        {
          nodeId: this.#env.OPENBOT_NODE_ID,
          workDirectory: this.#env.OPENBOT_NODE_WORK_DIRECTORY,
          signal: controller.signal,
        },
        {
          runId: offer.runId,
          channelId: offer.channelId,
          botId: offer.botId,
          title: offer.title,
          instruction: offer.instruction,
          executionProfile: offer.executionProfile,
        },
        (progress) => {
          this.#send({
            type: "run.progress",
            protocolVersion,
            nodeId: this.#env.OPENBOT_NODE_ID,
            runId,
            stage: progress.stage.slice(0, 80),
            message: progress.message.slice(0, 500),
            occurredAt: new Date().toISOString(),
          });
        },
        (frame) => {
          const message = runFrameSchema.safeParse({
            type: "run.frame",
            protocolVersion,
            nodeId: this.#env.OPENBOT_NODE_ID,
            runId,
            mediaType: frame.mediaType,
            base64: frame.base64,
            ...(frame.width === undefined ? {} : { width: frame.width }),
            ...(frame.height === undefined ? {} : { height: frame.height }),
            capturedAt: frame.capturedAt,
          });
          if (message.success) {
            this.#send(message.data);
          } else {
            console.warn("Provider emitted an invalid or oversized live frame; frame skipped.");
          }
        },
        (action) => this.#requestApproval(runId, action, controller.signal),
      );
      if (controller.signal.aborted) return;
      if (!result.ok) {
        this.#sendFailure(runId, result.summary);
        return;
      }
      this.#send({
        type: "run.completed",
        protocolVersion,
        nodeId: this.#env.OPENBOT_NODE_ID,
        runId,
        summary: result.summary.slice(0, 2000),
        artifacts: result.artifacts,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        this.#sendFailure(
          runId,
          error instanceof Error ? error.message : "Provider execution failed.",
        );
      }
    } finally {
      this.#executions.delete(runId);
    }
  }

  #sendFailure(runId: string, error: string): void {
    this.#send({
      type: "run.failed",
      protocolVersion,
      nodeId: this.#env.OPENBOT_NODE_ID,
      runId,
      error: error.slice(0, 2000) || "Provider execution failed.",
      failedAt: new Date().toISOString(),
    });
  }

  #send(message: NodeMessage): void {
    if (this.#socket?.readyState === WebSocket.OPEN) {
      this.#socket.send(JSON.stringify(message));
    }
  }

  #requestApproval(
    runId: string,
    action: PreparedAction,
    signal: AbortSignal,
  ): Promise<ApprovalOutcome> {
    if (action.risk === "read") {
      throw new Error("Read-only actions must not request an approval lease.");
    }
    if (this.#socket?.readyState !== WebSocket.OPEN) {
      throw new Error("Approval request could not reach the Server.");
    }
    const requestId = randomUUID();
    const expiresInSeconds = Math.floor(
      Math.min(900, Math.max(30, action.expiresInSeconds ?? 300)),
    );
    const message = approvalRequestSchema.parse({
      type: "approval.request",
      protocolVersion,
      nodeId: this.#env.OPENBOT_NODE_ID,
      runId,
      requestId,
      action: action.action,
      target: action.target,
      summary: action.summary,
      risk: action.risk,
      beforeState: action.beforeState ?? {},
      expiresInSeconds,
      requestedAt: new Date().toISOString(),
    });

    return new Promise((resolve, reject) => {
      const finishWithError = (error: Error) => {
        const waiter = this.#approvalWaiters.get(requestId);
        if (waiter === undefined) return;
        clearTimeout(waiter.timer);
        this.#approvalWaiters.delete(requestId);
        waiter.reject(error);
      };
      const timer = setTimeout(
        () => finishWithError(new Error("Approval request expired before it was decided.")),
        expiresInSeconds * 1000,
      );
      this.#approvalWaiters.set(requestId, { runId, resolve, reject, timer });
      signal.addEventListener(
        "abort",
        () => finishWithError(new Error("Approval request was cancelled.")),
        { once: true },
      );
      this.#send(message);
    });
  }

  #releaseRun(runId: string): void {
    this.#executions.get(runId)?.abort();
    this.#executions.delete(runId);
    this.#assignedRunIds.delete(runId);
    this.#acceptedOffers.delete(runId);
  }

  #abortExecutions(): void {
    for (const controller of this.#executions.values()) controller.abort();
    this.#executions.clear();
    for (const [requestId, waiter] of this.#approvalWaiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("Node connection closed while approval was pending."));
      this.#approvalWaiters.delete(requestId);
    }
  }
}

export function runOfferRejectionReason(
  offer: RunOffer,
  available: NodeCapability[],
  availableManifest: NodeCapabilityDescriptor[],
  activeRuns: number,
  maxConcurrentRuns: number,
): string | undefined {
  if (activeRuns >= maxConcurrentRuns) return "Node is at capacity.";
  const capabilities = new Set(available);
  const missing = offer.requiredCapabilities.filter((capability) => !capabilities.has(capability));
  if (missing.length > 0) return `Missing legacy capabilities: ${missing.join(", ")}.`;
  const mismatch = firstCapabilityRequirementMismatch(
    offer.requiredCapabilityManifest,
    availableManifest,
  );
  if (mismatch === undefined) return undefined;
  if (mismatch.reason === "capability-missing") {
    return `Missing capability: ${mismatch.capability}@${mismatch.expectedVersion}.`;
  }
  return `Unsupported capability version: ${mismatch.capability}@${mismatch.expectedVersion}; advertised ${mismatch.advertisedVersions.join(", ")}.`;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
