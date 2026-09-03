import { z } from "zod";

export const protocolVersion = "0.5.0" as const;

export const nodeCapabilitySchema = z.enum([
  "browser",
  "shell",
  "screenshot",
  "cua",
  "lume",
  "coder",
]);

export type NodeCapability = z.infer<typeof nodeCapabilitySchema>;

export const nodeHelloSchema = z.object({
  type: z.literal("node.hello"),
  protocolVersion: z.literal(protocolVersion),
  nodeId: z.string().min(1),
  name: z.string().min(1),
  platform: z.enum(["linux", "macos", "unknown"]),
  capabilities: z.array(nodeCapabilitySchema),
  maxConcurrentRuns: z.number().int().min(1).max(16),
  token: z.string().min(1),
  sentAt: z.string().datetime(),
});

export const nodeHeartbeatSchema = z.object({
  type: z.literal("node.heartbeat"),
  protocolVersion: z.literal(protocolVersion),
  nodeId: z.string().min(1),
  activeRunIds: z.array(z.string().uuid()).max(16),
  sentAt: z.string().datetime(),
});

export const runAcceptSchema = z.object({
  type: z.literal("run.accept"),
  protocolVersion: z.literal(protocolVersion),
  nodeId: z.string().min(1),
  offerId: z.string().uuid(),
  runId: z.string().uuid(),
  acceptedAt: z.string().datetime(),
});

export const runRejectSchema = z.object({
  type: z.literal("run.reject"),
  protocolVersion: z.literal(protocolVersion),
  nodeId: z.string().min(1),
  offerId: z.string().uuid(),
  runId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
  rejectedAt: z.string().datetime(),
});

export const runStartRequestSchema = z.object({
  type: z.literal("run.start_request"),
  protocolVersion: z.literal(protocolVersion),
  nodeId: z.string().min(1),
  runId: z.string().uuid(),
  requestedAt: z.string().datetime(),
});

export const runProgressSchema = z.object({
  type: z.literal("run.progress"),
  protocolVersion: z.literal(protocolVersion),
  nodeId: z.string().min(1),
  runId: z.string().uuid(),
  stage: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(500),
  occurredAt: z.string().datetime(),
});

export const runFrameSchema = z.object({
  type: z.literal("run.frame"),
  protocolVersion: z.literal(protocolVersion),
  nodeId: z.string().min(1),
  runId: z.string().uuid(),
  mediaType: z.literal("image/png"),
  base64: z
    .string()
    .min(12)
    .max(2_800_000)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
  capturedAt: z.string().datetime(),
});

export const approvalRequestSchema = z.object({
  type: z.literal("approval.request"),
  protocolVersion: z.literal(protocolVersion),
  nodeId: z.string().min(1),
  runId: z.string().uuid(),
  requestId: z.string().uuid(),
  action: z.string().trim().min(1).max(120),
  target: z.string().trim().min(1).max(2048),
  summary: z.string().trim().min(1).max(500),
  risk: z.enum(["write", "destructive", "privileged"]),
  beforeState: z.record(z.string(), z.unknown()).default({}),
  expiresInSeconds: z.number().int().min(30).max(900).default(300),
  requestedAt: z.string().datetime(),
});

const screenshotMetadataSchema = z
  .object({
    width: z.number().int().positive().max(20_000).optional(),
    height: z.number().int().positive().max(20_000).optional(),
    capturedAt: z.string().datetime().optional(),
    url: z.string().url().max(2048).optional(),
  })
  .strict();

export const completedArtifactSchema = z.object({
  name: z.string().trim().min(1).max(160),
  mediaType: z.literal("image/png"),
  base64: z
    .string()
    .min(12)
    .max(7_000_000)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  metadata: screenshotMetadataSchema.optional(),
});

export type CompletedArtifact = z.infer<typeof completedArtifactSchema>;

export const runCompletedSchema = z.object({
  type: z.literal("run.completed"),
  protocolVersion: z.literal(protocolVersion),
  nodeId: z.string().min(1),
  runId: z.string().uuid(),
  summary: z.string().trim().min(1).max(2000),
  artifacts: z.array(completedArtifactSchema).max(4),
  completedAt: z.string().datetime(),
});

export const runFailedSchema = z.object({
  type: z.literal("run.failed"),
  protocolVersion: z.literal(protocolVersion),
  nodeId: z.string().min(1),
  runId: z.string().uuid(),
  error: z.string().trim().min(1).max(2000),
  failedAt: z.string().datetime(),
});

export const nodeMessageSchema = z.discriminatedUnion("type", [
  nodeHelloSchema,
  nodeHeartbeatSchema,
  runAcceptSchema,
  runRejectSchema,
  runStartRequestSchema,
  runProgressSchema,
  runFrameSchema,
  approvalRequestSchema,
  runCompletedSchema,
  runFailedSchema,
]);

export type NodeMessage = z.infer<typeof nodeMessageSchema>;

export const serverAckSchema = z.object({
  type: z.literal("server.ack"),
  protocolVersion: z.literal(protocolVersion),
  accepted: z.boolean(),
  reason: z.string().optional(),
  receivedAt: z.string().datetime(),
});

export type ServerAck = z.infer<typeof serverAckSchema>;

export const runOfferSchema = z.object({
  type: z.literal("run.offer"),
  protocolVersion: z.literal(protocolVersion),
  offerId: z.string().uuid(),
  runId: z.string().uuid(),
  channelId: z.string().uuid(),
  botId: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  instruction: z.string().trim().min(1).max(8000),
  executionProfile: z.enum(["docker-linux", "macos-cua", "lume-vm", "coder"]),
  requiredCapabilities: z.array(nodeCapabilitySchema).min(1),
  sentAt: z.string().datetime(),
});

export type RunOffer = z.infer<typeof runOfferSchema>;

export const runAssignedSchema = z.object({
  type: z.literal("run.assigned"),
  protocolVersion: z.literal(protocolVersion),
  runId: z.string().uuid(),
  nodeId: z.string().min(1),
  assignedAt: z.string().datetime(),
});

export const runCancelSchema = z.object({
  type: z.literal("run.cancel"),
  protocolVersion: z.literal(protocolVersion),
  runId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
  cancelledAt: z.string().datetime(),
});

export const runStartSchema = z.object({
  type: z.literal("run.start"),
  protocolVersion: z.literal(protocolVersion),
  runId: z.string().uuid(),
  nodeId: z.string().min(1),
  startedAt: z.string().datetime(),
});

export const runSettledSchema = z.object({
  type: z.literal("run.settled"),
  protocolVersion: z.literal(protocolVersion),
  runId: z.string().uuid(),
  nodeId: z.string().min(1),
  status: z.enum(["completed", "failed"]),
  settledAt: z.string().datetime(),
});

export const approvalResolvedSchema = z.object({
  type: z.literal("approval.resolved"),
  protocolVersion: z.literal(protocolVersion),
  nodeId: z.string().min(1),
  runId: z.string().uuid(),
  requestId: z.string().uuid(),
  decision: z.enum(["approved", "rejected", "expired"]),
  decidedAt: z.string().datetime(),
});

export const serverMessageSchema = z.discriminatedUnion("type", [
  serverAckSchema,
  runOfferSchema,
  runAssignedSchema,
  runCancelSchema,
  runStartSchema,
  runSettledSchema,
  approvalResolvedSchema,
]);

export type ServerMessage = z.infer<typeof serverMessageSchema>;

export const runEventTypeSchema = z.enum([
  "CHANNEL_CREATED",
  "BOT_CREATED",
  "BOT_JOINED_CHANNEL",
  "MESSAGE_CREATED",
  "RUN_CREATED",
  "RUN_ASSIGNED",
  "RUN_REQUEUED",
  "RUN_STARTED",
  "RUN_PROGRESS",
  "RUN_PLAN_UPDATED",
  "NODE_BOUND",
  "APPROVAL_REQUESTED",
  "APPROVAL_APPROVED",
  "APPROVAL_REJECTED",
  "APPROVAL_EXPIRED",
  "FRAME_UPDATED",
  "ARTIFACT_CREATED",
  "RUN_BLOCKED",
  "RUN_COMPLETED",
  "RUN_FAILED",
]);

export const runEventSchema = z.object({
  id: z.string().min(1),
  type: runEventTypeSchema,
  runId: z.string().min(1).optional(),
  channelId: z.string().min(1).optional(),
  botId: z.string().min(1).optional(),
  nodeId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
});

export type RunEvent = z.infer<typeof runEventSchema>;

export const computerProfileSchema = z.enum([
  "none",
  "docker-linux",
  "macos-cua",
  "lume-vm",
  "coder",
]);

export const botAppearanceSchema = z.object({
  head: z.enum(["round", "square", "cat"]),
  body: z.enum(["classic", "tall", "cape", "armor", "storage", "quadruped"]),
  mobility: z.enum(["feet", "single-wheel", "dual-wheel", "hover", "four-legs"]),
  accessory: z.enum(["none", "headphones", "backpack", "trench", "arm", "toolbox"]),
  accent: z.enum(["green", "yellow", "red", "blue"]),
});

export const createBotInputSchema = z.object({
  name: z.string().trim().min(1, "Bot name is required.").max(64),
  role: z.string().trim().min(1, "Bot role is required.").max(160),
  computerProfile: computerProfileSchema.default("none"),
  appearance: botAppearanceSchema.optional(),
});

export const createChannelInputSchema = z.object({
  name: z.string().trim().min(1, "Channel name is required.").max(80),
  description: z.string().trim().max(500).default(""),
  botIds: z
    .array(z.string().uuid())
    .max(32)
    .default([])
    .transform((ids) => [...new Set(ids)]),
});

export const joinChannelBotInputSchema = z.object({
  botId: z.string().uuid(),
});

export const createMessageInputSchema = z.object({
  content: z.string().trim().min(1, "Message is required.").max(8000),
  botId: z.string().uuid().optional(),
  replyToMessageId: z.string().uuid().optional(),
});

export const approvalDecisionInputSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

export const loginInputSchema = z.object({
  password: z.string().min(1, "Password is required.").max(1024),
});
