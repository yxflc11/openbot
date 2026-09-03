import { z } from "zod";

export const protocolVersion = "0.1.0" as const;

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
  token: z.string().min(1),
  sentAt: z.string().datetime(),
});

export const nodeHeartbeatSchema = z.object({
  type: z.literal("node.heartbeat"),
  protocolVersion: z.literal(protocolVersion),
  nodeId: z.string().min(1),
  activeRunIds: z.array(z.string()),
  sentAt: z.string().datetime(),
});

export const nodeMessageSchema = z.discriminatedUnion("type", [
  nodeHelloSchema,
  nodeHeartbeatSchema,
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

export const runEventTypeSchema = z.enum([
  "CHANNEL_CREATED",
  "BOT_CREATED",
  "BOT_JOINED_CHANNEL",
  "RUN_CREATED",
  "RUN_PLAN_UPDATED",
  "NODE_BOUND",
  "APPROVAL_REQUESTED",
  "FRAME_UPDATED",
  "ARTIFACT_CREATED",
  "RUN_BLOCKED",
  "RUN_COMPLETED",
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
