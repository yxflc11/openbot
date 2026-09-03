import { createHash, randomUUID } from "node:crypto";
import type {
  Approval,
  ApprovalDecision,
  ApprovalResolution,
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
  approvals as approvalsTable,
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
  RequestApprovalInput,
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

  async listApprovals(): Promise<Approval[]> {
    const rows = await this.#db
      .select({ approval: approvalsTable, channelId: runs.channelId, botId: runs.botId })
      .from(approvalsTable)
      .innerJoin(runs, eq(approvalsTable.runId, runs.id))
      .orderBy(desc(approvalsTable.createdAt))
      .limit(100);
    return rows.map((row) => toApproval(row.approval, row.channelId, row.botId));
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
      configuration: input.appearance === undefined ? {} : { appearance: input.appearance },
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
    const runId = randomUUID();
    const message = {
      id: randomUUID(),
      channelId,
      authorType: "human" as const,
      authorId: null,
      replyToMessageId: input.replyToMessageId ?? null,
      runId,
      content: input.content,
      createdAt: now,
    };
    let selectedBotId: string | undefined;
    let selectedExecutionProfile: Bot["computerProfile"] | undefined;

    // The source message, queued Run, and both audit events must become visible together.
    await this.#db.transaction(async (transaction) => {
      const channelRows = await transaction
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);
      if (channelRows.length === 0) {
        throw new StoreNotFoundError("Channel not found.");
      }

      if (input.replyToMessageId !== undefined) {
        const [replyTarget] = await transaction
          .select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.id, input.replyToMessageId), eq(messages.channelId, channelId)))
          .limit(1);
        if (replyTarget === undefined) {
          throw new StoreValidationError("The replied message does not belong to this channel.");
        }
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

  async requestApproval(
    runId: string,
    nodeId: string,
    input: RequestApprovalInput,
  ): Promise<ApprovalResolution | undefined> {
    const now = new Date();
    const expiresAt = new Date(input.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
      throw new StoreValidationError("Approval expiry must be in the future.");
    }
    const targetFingerprint = approvalTargetFingerprint(input);

    try {
      return await this.#db.transaction(async (transaction) => {
        const [updatedRun] = await transaction
          .update(runs)
          .set({ status: "waiting_approval", updatedAt: now })
          .where(and(eq(runs.id, runId), eq(runs.nodeId, nodeId), eq(runs.status, "running")))
          .returning();
        if (updatedRun === undefined) return undefined;

        const [approval] = await transaction
          .insert(approvalsTable)
          .values({
            id: input.requestId,
            runId,
            nodeId,
            action: input.action,
            target: input.target,
            summary: input.summary,
            risk: input.risk,
            targetFingerprint,
            status: "pending",
            beforeState: input.beforeState,
            expiresAt,
            createdAt: now,
          })
          .returning();
        if (approval === undefined) throw new Error("Approval was not persisted.");

        await transaction.insert(runEvents).values({
          id: randomUUID(),
          runId,
          channelId: updatedRun.channelId,
          botId: updatedRun.botId,
          nodeId,
          type: "APPROVAL_REQUESTED",
          payload: {
            approvalId: approval.id,
            action: approval.action,
            risk: approval.risk,
            targetFingerprint,
            expiresAt: expiresAt.toISOString(),
          },
        });
        return {
          approval: toApproval(approval, updatedRun.channelId, updatedRun.botId),
          run: toRun(updatedRun),
        };
      });
    } catch (error) {
      translateDatabaseError(error, "This approval request has already been recorded.");
    }
  }

  async decideApproval(
    approvalId: string,
    decision: ApprovalDecision,
    decidedBy: string,
  ): Promise<ApprovalResolution> {
    const now = new Date();
    // Conditional updates make a decision single-use even when two Owner clients race.
    return this.#db.transaction(async (transaction) => {
      const [current] = await transaction
        .select({ approval: approvalsTable, run: runs })
        .from(approvalsTable)
        .innerJoin(runs, eq(approvalsTable.runId, runs.id))
        .where(eq(approvalsTable.id, approvalId))
        .limit(1);
      if (current === undefined) throw new StoreNotFoundError("Approval not found.");
      if (current.approval.status !== "pending") {
        throw new StoreConflictError("Approval has already been resolved.");
      }
      if (current.run.status !== "waiting_approval") {
        throw new StoreConflictError("The run is no longer waiting for this approval.");
      }

      const expired = current.approval.expiresAt <= now;
      const status = expired ? "expired" : decision === "approve" ? "approved" : "rejected";
      const runStatus = status === "approved" ? "running" : "blocked";
      const [updatedApproval] = await transaction
        .update(approvalsTable)
        .set({ status, decidedBy, decidedAt: now })
        .where(and(eq(approvalsTable.id, approvalId), eq(approvalsTable.status, "pending")))
        .returning();
      if (updatedApproval === undefined) {
        throw new StoreConflictError("Approval has already been resolved.");
      }
      const [updatedRun] = await transaction
        .update(runs)
        .set({ status: runStatus, updatedAt: now })
        .where(and(eq(runs.id, current.run.id), eq(runs.status, "waiting_approval")))
        .returning();
      if (updatedRun === undefined) {
        throw new StoreConflictError("The run is no longer waiting for this approval.");
      }

      await transaction.insert(runEvents).values({
        id: randomUUID(),
        runId: updatedRun.id,
        channelId: updatedRun.channelId,
        botId: updatedRun.botId,
        nodeId: updatedApproval.nodeId,
        type:
          status === "approved"
            ? "APPROVAL_APPROVED"
            : status === "rejected"
              ? "APPROVAL_REJECTED"
              : "APPROVAL_EXPIRED",
        payload: {
          approvalId: updatedApproval.id,
          action: updatedApproval.action,
          targetFingerprint: updatedApproval.targetFingerprint,
          decidedBy,
        },
      });
      return {
        approval: toApproval(updatedApproval, updatedRun.channelId, updatedRun.botId),
        run: toRun(updatedRun),
      };
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
    // Publish only after the terminal Run, Bot reply, artifacts, and audit events commit together.
    return this.#db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(runs)
        .set({ status: "completed", resultSummary: summary, errorMessage: null, updatedAt: now })
        .where(and(eq(runs.id, runId), eq(runs.nodeId, nodeId), eq(runs.status, "running")))
        .returning();
      if (updated === undefined) return undefined;

      const message = {
        id: randomUUID(),
        channelId: updated.channelId,
        authorType: "bot" as const,
        authorId: updated.botId,
        replyToMessageId: updated.sourceMessageId,
        runId: updated.id,
        content: summary,
        createdAt: now,
      };
      await transaction.insert(messages).values(message);

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
      await transaction.insert(runEvents).values([
        {
          id: randomUUID(),
          runId,
          channelId: updated.channelId,
          botId: updated.botId,
          nodeId,
          type: "MESSAGE_CREATED",
          payload: {
            messageId: message.id,
            authorType: message.authorType,
            replyToMessageId: message.replyToMessageId,
          },
        },
        {
          id: randomUUID(),
          runId,
          channelId: updated.channelId,
          botId: updated.botId,
          nodeId,
          type: "RUN_COMPLETED",
          payload: { summary, artifactIds: artifacts.map((artifact) => artifact.id) },
        },
      ]);
      return {
        run: toRun(updated),
        artifacts: artifacts.map(stripArtifactRecord),
        message: toMessage(message),
      };
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
        osVersion: node.osVersion,
        architecture: node.architecture,
        deviceClass: node.deviceClass,
        isolation: node.isolation,
        trustTier: node.trustTier,
        capabilities: node.capabilities,
        capabilityManifest: node.capabilityManifest,
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
          osVersion: node.osVersion,
          architecture: node.architecture,
          deviceClass: node.deviceClass,
          isolation: node.isolation,
          trustTier: node.trustTier,
          capabilities: node.capabilities,
          capabilityManifest: node.capabilityManifest,
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
  const configuration = asRecord(row.configuration);
  const appearance = toBotAppearance(configuration.appearance);
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    status: row.status as Bot["status"],
    computerProfile: row.computerProfile as Bot["computerProfile"],
    ...(appearance === undefined ? {} : { appearance }),
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

function toMessage(row: typeof messages.$inferSelect | typeof messages.$inferInsert): Message {
  return {
    id: row.id,
    channelId: row.channelId,
    authorType: row.authorType as Message["authorType"],
    ...(row.authorId === null || row.authorId === undefined ? {} : { authorId: row.authorId }),
    ...(row.replyToMessageId === null || row.replyToMessageId === undefined
      ? {}
      : { replyToMessageId: row.replyToMessageId }),
    ...(row.runId === null || row.runId === undefined ? {} : { runId: row.runId }),
    content: row.content,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

function toBotAppearance(value: unknown): Bot["appearance"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    !["round", "square", "cat"].includes(String(candidate.head)) ||
    !["classic", "tall", "cape", "armor", "storage", "quadruped"].includes(
      String(candidate.body),
    ) ||
    !["feet", "single-wheel", "dual-wheel", "hover", "four-legs"].includes(
      String(candidate.mobility),
    ) ||
    !["none", "headphones", "backpack", "trench", "arm", "toolbox"].includes(
      String(candidate.accessory),
    ) ||
    !["green", "yellow", "red", "blue"].includes(String(candidate.accent))
  ) {
    return undefined;
  }
  return {
    head: candidate.head as NonNullable<Bot["appearance"]>["head"],
    body: candidate.body as NonNullable<Bot["appearance"]>["body"],
    mobility: candidate.mobility as NonNullable<Bot["appearance"]>["mobility"],
    accessory: candidate.accessory as NonNullable<Bot["appearance"]>["accessory"],
    accent: candidate.accent as NonNullable<Bot["appearance"]>["accent"],
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

function toApproval(
  row: typeof approvalsTable.$inferSelect,
  channelId: string,
  botId: string,
): Approval {
  return {
    id: row.id,
    runId: row.runId,
    channelId,
    botId,
    nodeId: row.nodeId,
    action: row.action,
    target: row.target,
    summary: row.summary,
    risk: row.risk as Approval["risk"],
    targetFingerprint: row.targetFingerprint,
    beforeState: asRecord(row.beforeState),
    status: row.status as Approval["status"],
    expiresAt: row.expiresAt.toISOString(),
    ...(row.decidedBy === null ? {} : { decidedBy: row.decidedBy }),
    ...(row.decidedAt === null ? {} : { decidedAt: row.decidedAt.toISOString() }),
    createdAt: row.createdAt.toISOString(),
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

function approvalTargetFingerprint(input: RequestApprovalInput): string {
  return createHash("sha256")
    .update(input.action)
    .update("\0")
    .update(input.target)
    .update("\0")
    .update(JSON.stringify(input.beforeState))
    .digest("hex");
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
