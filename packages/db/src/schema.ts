import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const channels = pgTable(
  "channels",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("channels_name_idx").on(table.name),
    check("channels_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const bots = pgTable(
  "bots",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("idle"),
    computerProfile: text("computer_profile").notNull().default("none"),
    configuration: jsonb("configuration").notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("bots_name_idx").on(table.name),
    check("bots_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const channelBots = pgTable(
  "channel_bots",
  {
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.channelId, table.botId] }),
    index("channel_bots_bot_idx").on(table.botId),
  ],
);

export const nodes = pgTable("nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  platform: text("platform").notNull(),
  capabilities: jsonb("capabilities").notNull().default([]),
  status: text("status").notNull().default("offline"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  ...timestamps,
});

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    authorType: text("author_type").notNull(),
    authorId: text("author_id"),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("messages_channel_time_idx").on(table.channelId, table.createdAt),
    check("messages_author_type_valid", sql`${table.authorType} IN ('human', 'bot', 'system')`),
    check("messages_content_not_blank", sql`length(btrim(${table.content})) > 0`),
  ],
);

export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id),
    sourceMessageId: text("source_message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    nodeId: text("node_id").references(() => nodes.id),
    title: text("title").notNull(),
    status: text("status").notNull().default("queued"),
    ...timestamps,
  },
  (table) => [
    index("runs_created_idx").on(table.createdAt),
    index("runs_channel_created_idx").on(table.channelId, table.createdAt),
    index("runs_bot_idx").on(table.botId),
    index("runs_node_idx").on(table.nodeId),
    index("runs_status_created_idx").on(table.status, table.createdAt),
    uniqueIndex("runs_source_message_idx")
      .on(table.sourceMessageId)
      .where(sql`${table.sourceMessageId} IS NOT NULL`),
    check("runs_title_not_blank", sql`length(btrim(${table.title})) > 0`),
    check(
      "runs_status_valid",
      sql`${table.status} IN ('queued', 'running', 'waiting_approval', 'blocked', 'completed', 'failed', 'cancelled')`,
    ),
  ],
);

export const runEvents = pgTable(
  "run_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").references(() => runs.id, { onDelete: "cascade" }),
    channelId: text("channel_id").references(() => channels.id),
    botId: text("bot_id").references(() => bots.id),
    nodeId: text("node_id").references(() => nodes.id),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("run_events_run_time_idx").on(table.runId, table.createdAt),
    index("run_events_channel_time_idx").on(table.channelId, table.createdAt),
    index("run_events_bot_idx").on(table.botId),
    index("run_events_node_idx").on(table.nodeId),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    tokenDigest: text("token_digest").notNull(),
    ownerId: text("owner_id").notNull().default("owner"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_digest_idx").on(table.tokenDigest),
    index("auth_sessions_active_expiry_idx")
      .on(table.expiresAt)
      .where(sql`${table.revokedAt} IS NULL`),
    check("auth_sessions_owner_valid", sql`${table.ownerId} = 'owner'`),
    check("auth_sessions_token_digest_valid", sql`length(${table.tokenDigest}) = 64`),
  ],
);

export const approvals = pgTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    target: text("target").notNull(),
    status: text("status").notNull().default("pending"),
    beforeState: jsonb("before_state").notNull().default({}),
    decidedBy: text("decided_by"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("approvals_run_status_idx").on(table.runId, table.status)],
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mediaType: text("media_type").notNull(),
    storageKey: text("storage_key").notNull(),
    sha256: text("sha256").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("artifacts_run_idx").on(table.runId)],
);
