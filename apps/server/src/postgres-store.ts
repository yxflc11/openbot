import { randomUUID } from "node:crypto";
import type {
  Artifact,
  Bot,
  Channel,
  CreateBotInput,
  CreateChannelInput,
  CreateMessageInput,
  ExecutionNode,
  Message,
  Run,
  RunProgress,
  SubmitTaskResult,
} from "@openbot/domain";
import {
  artifacts as artifactsTable,
  bots,
  channelBots,
  channels,
  messages,
  nodes,
  runEvents,
  runs,
} from "@openbot/db";
import { and, asc, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import type {
  ArtifactRecord,
  ControlPlaneStore,
  PersistedCounts,
  RunCompletion,
} from "./control-plane-store.js";
import {
  StoreConflictError,
  StoreNotFoundError,
  StoreValidationError,
} from "./control-plane-store.js";
import { selectChannelAssignee } from "./task-routing.js";

type Database = ReturnType<typeof import("@openbot/db")["createDatabase"]>["db"];

const activeRunStatuses = ["queued", "assigned", "running", "waiting_approval", "blocked"];

export class PostgresControlPlaneStore implements ControlPlaneStore {
  readonly #db: Database;

  constructor(database: Database) {
    this.#db = database;
  }

  async channelExists(channelId: string): Promise<boolean> {
    const rows = await this.#db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);
    return rows.length > 0;
  }

  async listChannels(): Promise<Channel[]> {
    const rows = await this.#db
      .select({
        id: channels.id,
        name: channels.name,
        description: channels.description,
        createdAt: channels.createdAt,
        botId: channelBots.botId,
      })
      .from(channels)
      .leftJoin(channelBots, eq(channelBots.channelId, channels.id))
      .orderBy(desc(channels.createdAt));

    const result = new Map<string, Channel>();
    for (const row of rows) {
      const channel = result.get(row.id) ?? {
        id: row.id,
        name: row.name,
        description: row.description,
        botIds: [],
        createdAt: row.createdAt.toISOString(),
      };
      if (row.botId !== null) {
        channel.botIds.push(row.botId);
      }
      result.set(row.id, channel);
    }
    return Array.from(result.values());
  }

  async listBots(): Promise<Bot[]> {
    const rows = await this.#db.select().from(bots).orderBy(desc(bots.createdAt));
    return rows.map(toBot);
  }

  async listMessages(channelId: string): Promise<Message[]> {
    await this.#requireChannel(channelId);
    const rows = await this.#db
      .select()
      .from(messages)
      .where(eq(messages.channelId, channelId))
      .orderBy(desc(messages.createdAt))
      .limit(100);
    return rows.reverse().map(toMessage);
  }

  async listRuns(channelId?: string): Promise<Run[]> {
    if (channelId !== undefined) {
      await this.#requireChannel(channelId);
      const rows = await this.#db
        .select()
        .from(runs)
        .where(eq(runs.channelId, channelId))
        .orderBy(desc(runs.createdAt))
        .limit(50);
      return rows.map(toRun);
    }

    const rows = await this.#db.select().from(runs).orderBy(desc(runs.createdAt)).limit(50);
    return rows.map(toRun);
  }

  async listRunProgress(channelId?: string): Promise<RunProgress[]> {
    if (channelId !== undefined) await this.#requireChannel(channelId);
    const query = this.#db
      .select()
      .from(runEvents)
      .where(
        channelId === undefined
          ? eq(runEvents.type, "RUN_PROGRESS")
          : and(eq(runEvents.type, "RUN_PROGRESS"), eq(runEvents.channelId, channelId)),
      )
      .orderBy(desc(runEvents.createdAt))
      .limit(200);
    const rows = await query;
    return rows.reverse().flatMap(toRunProgress);
  }

  async listArtifacts(runId?: string): Promise<Artifact[]> {
    const query = this.#db.select().from(artifactsTable);
    const rows = await (runId === undefined
      ? query.orderBy(desc(artifactsTable.createdAt)).limit(100)
      : query
          .where(eq(artifactsTable.runId, runId))
          .orderBy(desc(artifactsTable.createdAt))
          .limit(100));
    return rows.map(toArtifact);
  }

  async getArtifact(artifactId: string): Promise<ArtifactRecord | undefined> {
    const [row] = await this.#db
      .select()
      .from(artifactsTable)
      .where(eq(artifactsTable.id, artifactId))
      .limit(1);
    return row === undefined ? undefined : toArtifactRecord(row);
  }

  async listDispatchableRuns(limit = 50): Promise<Run[]> {
    const rows = await this.#db
      .select()
      .from(runs)
      .where(and(eq(runs.status, "queued"), isNull(runs.nodeId), ne(runs.executionProfile, "none")))
      .orderBy(asc(runs.createdAt), asc(runs.id))
      .limit(limit);
    return rows.map(toRun);
  }

  async getRunningRunForNode(runId: string, nodeId: string): Promise<Run | undefined> {
    const [row] = await this.#db
      .select()
      .from(runs)
      .where(and(eq(runs.id, runId), eq(runs.nodeId, nodeId), eq(runs.status, "running")))
      .limit(1);
    return row === undefined ? undefined : toRun(row);
  }

  async getCounts(): Promise<PersistedCounts> {
    const [channelCount, botCount, activeRunCount] = await Promise.all([
      this.#db.select({ value: count() }).from(channels),
      this.#db.select({ value: count() }).from(bots),
      this.#db.select({ value: count() }).from(runs).where(inArray(runs.status, activeRunStatuses)),
    ]);
    return {
      channels: channelCount[0]?.value ?? 0,
      bots: botCount[0]?.value ?? 0,
      activeRuns: activeRunCount[0]?.value ?? 0,
    };
  }

  async createBot(input: CreateBotInput): Promise<Bot> {
    const now = new Date();
    const bot = {
      id: randomUUID(),
      name: input.name,
      role: input.role,
      status: "idle" as const,
      computerProfile: input.computerProfile,
      configuration: {},
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.#db.transaction(async (transaction) => {
        await transaction.insert(bots).values(bot);
        await transaction.insert(runEvents).values({
          id: randomUUID(),
          botId: bot.id,
          type: "BOT_CREATED",
          payload: { name: bot.name, role: bot.role },
        });
      });
    } catch (error) {
      translateDatabaseError(error, `A Bot named “${input.name}” already exists.`);
    }

    return toBot(bot);
  }

  async createChannel(input: CreateChannelInput): Promise<Channel> {
    const channelId = randomUUID();
    const now = new Date();

    try {
      await this.#db.transaction(async (transaction) => {
        if (input.botIds.length > 0) {
          const existingBots = await transaction
            .select({ id: bots.id })
            .from(bots)
            .where(inArray(bots.id, input.botIds));
          if (existingBots.length !== input.botIds.length) {
            throw new StoreValidationError("One or more selected Bots no longer exist.");
          }
        }

        await transaction.insert(channels).values({
          id: channelId,
          name: input.name,
          description: input.description,
          createdAt: now,
          updatedAt: now,
        });
        if (input.botIds.length > 0) {
          await transaction.insert(channelBots).values(
            input.botIds.map((botId) => ({
              channelId,
              botId,
              joinedAt: now,
            })),
          );
        }
        await transaction.insert(runEvents).values([
          {
            id: randomUUID(),
            channelId,
            type: "CHANNEL_CREATED",
            payload: { name: input.name },
          },
          ...input.botIds.map((botId) => ({
            id: randomUUID(),
            channelId,
            botId,
            type: "BOT_JOINED_CHANNEL",
            payload: {},
          })),
        ]);
      });
    } catch (error) {
      if (error instanceof StoreValidationError) {
        throw error;
      }
      translateDatabaseError(error, `A channel named “${input.name}” already exists.`);
    }

    return {
      id: channelId,
      name: input.name,
      description: input.description,
      botIds: input.botIds,
      createdAt: now.toISOString(),
    };
  }

  async submitTask(channelId: string, input: CreateMessageInput): Promise<SubmitTaskResult> {
    const now = new Date();
    const message = {
      id: randomUUID(),
      channelId,
      authorType: "human" as const,
      authorId: null,
      content: input.content,
      createdAt: now,
    };
    const runId = randomUUID();
    let selectedBotId: string | undefined;
    let selectedExecutionProfile: Bot["computerProfile"] | undefined;

    await this.#db.transaction(async (transaction) => {
      const channelRows = await transaction
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);
      if (channelRows.length === 0) {
        throw new StoreNotFoundError("Channel not found.");
      }

      const candidates = await transaction
        .select({
          id: bots.id,
          name: bots.name,
          role: bots.role,
          computerProfile: bots.computerProfile,
        })
        .from(channelBots)
        .innerJoin(bots, eq(channelBots.botId, bots.id))
        .where(eq(channelBots.channelId, channelId))
        .orderBy(asc(channelBots.joinedAt), asc(bots.createdAt), asc(bots.id));
      const assignee = selectChannelAssignee(candidates, input.botId);
      if (assignee === undefined) {
        throw new StoreValidationError(
          input.botId === undefined
            ? "Add a Bot to this channel before assigning a task."
            : "The selected Bot is not a member of this channel.",
        );
      }
      selectedBotId = assignee.id;
      selectedExecutionProfile = assignee.computerProfile as Bot["computerProfile"];

      await transaction.insert(messages).values(message);
      await transaction.insert(runs).values({
        id: runId,
        channelId,
        botId: assignee.id,
        sourceMessageId: message.id,
        executionProfile: assignee.computerProfile,
        instruction: input.content,
        title: taskTitle(input.content),
        status: "queued",
        createdAt: now,
        updatedAt: now,
      });
      await transaction.insert(runEvents).values([
        {
          id: randomUUID(),
          channelId,
          type: "MESSAGE_CREATED",
          payload: { messageId: message.id, authorType: message.authorType },
        },
        {
          id: randomUUID(),
          runId,
          channelId,
          botId: assignee.id,
          type: "RUN_CREATED",
          payload: {
            sourceMessageId: message.id,
            title: taskTitle(input.content),
            executionProfile: assignee.computerProfile,
          },
        },
      ]);
    });

    if (selectedBotId === undefined || selectedExecutionProfile === undefined) {
      throw new Error("Task assignee was not selected.");
    }
    return {
      message: toMessage(message),
      run: {
        id: runId,
        channelId,
        botId: selectedBotId,
        sourceMessageId: message.id,
        executionProfile: selectedExecutionProfile,
        instruction: input.content,
        title: taskTitle(input.content),
        status: "queued",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    };
  }

  async assignRun(runId: string, nodeId: string): Promise<Run | undefined> {
    const now = new Date();
    return this.#db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(runs)
        .set({ nodeId, status: "assigned", updatedAt: now })
        .where(and(eq(runs.id, runId), eq(runs.status, "queued"), isNull(runs.nodeId)))
        .returning();
      if (updated === undefined) return undefined;

      await transaction.insert(runEvents).values({
        id: randomUUID(),
        runId: updated.id,
        channelId: updated.channelId,
        botId: updated.botId,
        nodeId,
        type: "RUN_ASSIGNED",
        payload: { executionProfile: updated.executionProfile },
      });
      return toRun(updated);
    });
  }

  async startRun(runId: string, nodeId: string): Promise<Run | undefined> {
    const now = new Date();
    return this.#db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(runs)
        .set({ status: "running", updatedAt: now })
        .where(and(eq(runs.id, runId), eq(runs.nodeId, nodeId), eq(runs.status, "assigned")))
        .returning();
      if (updated === undefined) return undefined;
      await transaction.insert(runEvents).values({
        id: randomUUID(),
        runId,
        channelId: updated.channelId,
        botId: updated.botId,
        nodeId,
        type: "RUN_STARTED",
        payload: {},
      });
      return toRun(updated);
    });
  }

  async appendRunProgress(
    runId: string,
    nodeId: string,
    stage: string,
    message: string,
  ): Promise<RunProgress | undefined> {
    const now = new Date();
    return this.#db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(runs)
        .set({ updatedAt: now })
        .where(and(eq(runs.id, runId), eq(runs.nodeId, nodeId), eq(runs.status, "running")))
        .returning({
          channelId: runs.channelId,
          botId: runs.botId,
        });
      if (updated === undefined) return undefined;
      const progress: RunProgress = {
        id: randomUUID(),
        runId,
        channelId: updated.channelId,
        nodeId,
        stage,
        message,
        createdAt: now.toISOString(),
      };
      await transaction.insert(runEvents).values({
        id: progress.id,
        runId,
        channelId: updated.channelId,
        botId: updated.botId,
        nodeId,
        type: "RUN_PROGRESS",
        payload: { stage, message },
        createdAt: now,
      });
      return progress;
    });
  }

  async completeRun(
    runId: string,
    nodeId: string,
    summary: string,
    artifacts: ArtifactRecord[],
  ): Promise<RunCompletion | undefined> {
    const now = new Date();
    return this.#db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(runs)
        .set({ status: "completed", resultSummary: summary, errorMessage: null, updatedAt: now })
        .where(and(eq(runs.id, runId), eq(runs.nodeId, nodeId), eq(runs.status, "running")))
        .returning();
      if (updated === undefined) return undefined;

      if (artifacts.length > 0) {
        await transaction.insert(artifactsTable).values(
          artifacts.map((record) => ({
            id: record.id,
            runId: record.runId,
            name: record.name,
            mediaType: record.mediaType,
            storageKey: record.storageKey,
            sha256: record.sha256,
            metadata: record.metadata,
            createdAt: new Date(record.createdAt),
          })),
        );
      }
      await transaction.insert(runEvents).values({
        id: randomUUID(),
        runId,
        channelId: updated.channelId,
        botId: updated.botId,
        nodeId,
        type: "RUN_COMPLETED",
        payload: { summary, artifactIds: artifacts.map((artifact) => artifact.id) },
      });
      return { run: toRun(updated), artifacts: artifacts.map(stripArtifactRecord) };
    });
  }

  async failRun(runId: string, nodeId: string, error: string): Promise<Run | undefined> {
    const now = new Date();
    return this.#db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(runs)
        .set({ status: "failed", errorMessage: error, updatedAt: now })
        .where(and(eq(runs.id, runId), eq(runs.nodeId, nodeId), eq(runs.status, "running")))
        .returning();
      if (updated === undefined) return undefined;
      await transaction.insert(runEvents).values({
        id: randomUUID(),
        runId,
        channelId: updated.channelId,
        botId: updated.botId,
        nodeId,
        type: "RUN_FAILED",
        payload: { error },
      });
      return toRun(updated);
    });
  }

  async failRunningRuns(nodeId?: string): Promise<Run[]> {
    const now = new Date();
    return this.#db.transaction(async (transaction) => {
      const condition =
        nodeId === undefined
          ? eq(runs.status, "running")
          : and(eq(runs.status, "running"), eq(runs.nodeId, nodeId));
      const updated = await transaction
        .update(runs)
        .set({
          status: "failed",
          errorMessage: "Execution was interrupted before the Server received a result.",
          updatedAt: now,
        })
        .where(condition)
        .returning();
      if (updated.length === 0) return [];
      await transaction.insert(runEvents).values(
        updated.map((run) => ({
          id: randomUUID(),
          runId: run.id,
          channelId: run.channelId,
          botId: run.botId,
          nodeId: nodeId ?? run.nodeId,
          type: "RUN_FAILED",
          payload: { reason: nodeId === undefined ? "server-recovery" : "node-unavailable" },
        })),
      );
      return updated.map(toRun);
    });
  }

  async requeueAssignedRuns(nodeId?: string): Promise<Run[]> {
    const now = new Date();
    return this.#db.transaction(async (transaction) => {
      const condition =
        nodeId === undefined
          ? eq(runs.status, "assigned")
          : and(eq(runs.status, "assigned"), eq(runs.nodeId, nodeId));
      const updated = await transaction
        .update(runs)
        .set({ nodeId: null, status: "queued", updatedAt: now })
        .where(condition)
        .returning();
      if (updated.length === 0) return [];

      await transaction.insert(runEvents).values(
        updated.map((run) => ({
          id: randomUUID(),
          runId: run.id,
          channelId: run.channelId,
          botId: run.botId,
          nodeId: nodeId ?? run.nodeId,
          type: "RUN_REQUEUED",
          payload: { reason: nodeId === undefined ? "server-recovery" : "node-unavailable" },
        })),
      );
      return updated.map(toRun);
    });
  }

  async upsertNode(node: ExecutionNode): Promise<void> {
    const connectedAt = new Date(node.connectedAt);
    const lastSeenAt = new Date(node.lastSeenAt);
    const now = new Date();
    await this.#db
      .insert(nodes)
      .values({
        id: node.id,
        name: node.name,
        platform: node.platform,
        capabilities: node.capabilities,
        maxConcurrentRuns: node.maxConcurrentRuns,
        status: "online",
        connectedAt,
        lastSeenAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: nodes.id,
        set: {
          name: node.name,
          platform: node.platform,
          capabilities: node.capabilities,
          maxConcurrentRuns: node.maxConcurrentRuns,
          status: "online",
          connectedAt,
          lastSeenAt,
          updatedAt: now,
        },
      });
  }

  async markNodeOffline(nodeId: string): Promise<void> {
    await this.#db
      .update(nodes)
      .set({ status: "offline", lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(nodes.id, nodeId));
  }

  async joinBotToChannel(channelId: string, botId: string): Promise<Channel> {
    try {
      await this.#db.transaction(async (transaction) => {
        const [channelRows, botRows] = await Promise.all([
          transaction.select({ id: channels.id }).from(channels).where(eq(channels.id, channelId)),
          transaction.select({ id: bots.id }).from(bots).where(eq(bots.id, botId)),
        ]);
        if (channelRows.length === 0) {
          throw new StoreNotFoundError("Channel not found.");
        }
        if (botRows.length === 0) {
          throw new StoreNotFoundError("Bot not found.");
        }

        const inserted = await transaction
          .insert(channelBots)
          .values({ channelId, botId })
          .onConflictDoNothing()
          .returning({ botId: channelBots.botId });
        if (inserted.length > 0) {
          await transaction.insert(runEvents).values({
            id: randomUUID(),
            channelId,
            botId,
            type: "BOT_JOINED_CHANNEL",
            payload: {},
          });
        }
      });
    } catch (error) {
      if (error instanceof StoreNotFoundError) {
        throw error;
      }
      throw error;
    }

    const channel = (await this.listChannels()).find((item) => item.id === channelId);
    if (channel === undefined) {
      throw new StoreNotFoundError("Channel not found.");
    }
    return channel;
  }

  async #requireChannel(channelId: string): Promise<void> {
    if (!(await this.channelExists(channelId))) {
      throw new StoreNotFoundError("Channel not found.");
    }
  }
}

function toBot(row: typeof bots.$inferSelect | typeof bots.$inferInsert): Bot {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    status: row.status as Bot["status"],
    computerProfile: row.computerProfile as Bot["computerProfile"],
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

function toMessage(row: typeof messages.$inferSelect | typeof messages.$inferInsert): Message {
  return {
    id: row.id,
    channelId: row.channelId,
    authorType: row.authorType as Message["authorType"],
    ...(row.authorId === null || row.authorId === undefined ? {} : { authorId: row.authorId }),
    content: row.content,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

function toRun(row: typeof runs.$inferSelect | typeof runs.$inferInsert): Run {
  return {
    id: row.id,
    channelId: row.channelId,
    botId: row.botId,
    ...(row.sourceMessageId === null || row.sourceMessageId === undefined
      ? {}
      : { sourceMessageId: row.sourceMessageId }),
    ...(row.nodeId === null || row.nodeId === undefined ? {} : { nodeId: row.nodeId }),
    executionProfile: row.executionProfile as Run["executionProfile"],
    instruction: row.instruction ?? row.title,
    title: row.title,
    status: row.status as Run["status"],
    ...(row.resultSummary === null || row.resultSummary === undefined
      ? {}
      : { resultSummary: row.resultSummary }),
    ...(row.errorMessage === null || row.errorMessage === undefined
      ? {}
      : { errorMessage: row.errorMessage }),
    createdAt: (row.createdAt ?? new Date()).toISOString(),
    updatedAt: (row.updatedAt ?? new Date()).toISOString(),
  };
}

function toRunProgress(row: typeof runEvents.$inferSelect): RunProgress[] {
  const payload = asRecord(row.payload);
  if (
    row.runId === null ||
    row.channelId === null ||
    row.nodeId === null ||
    typeof payload.stage !== "string" ||
    typeof payload.message !== "string"
  ) {
    return [];
  }
  return [
    {
      id: row.id,
      runId: row.runId,
      channelId: row.channelId,
      nodeId: row.nodeId,
      stage: payload.stage,
      message: payload.message,
      createdAt: row.createdAt.toISOString(),
    },
  ];
}

function toArtifact(row: typeof artifactsTable.$inferSelect): Artifact {
  const metadata = asRecord(row.metadata);
  return {
    id: row.id,
    runId: row.runId,
    name: row.name,
    mediaType: row.mediaType,
    sha256: row.sha256,
    sizeBytes: typeof metadata.sizeBytes === "number" ? metadata.sizeBytes : 0,
    createdAt: row.createdAt.toISOString(),
  };
}

function toArtifactRecord(row: typeof artifactsTable.$inferSelect): ArtifactRecord {
  return { ...toArtifact(row), storageKey: row.storageKey, metadata: asRecord(row.metadata) };
}

function stripArtifactRecord({
  storageKey: _storageKey,
  metadata: _metadata,
  ...artifact
}: ArtifactRecord): Artifact {
  return artifact;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function taskTitle(content: string): string {
  return content.length <= 80 ? content : `${content.slice(0, 77)}...`;
}

function translateDatabaseError(error: unknown, conflictMessage: string): never {
  if (hasDatabaseCode(error, "23505")) {
    throw new StoreConflictError(conflictMessage);
  }
  throw error;
}

function hasDatabaseCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  if ("code" in error && error.code === code) {
    return true;
  }
  return "cause" in error && hasDatabaseCode(error.cause, code);
}
