import { randomUUID } from "node:crypto";
import { channelBots, messages, runEvents, runs } from "@openbot/db";
import type { Run, RunProgress } from "@openbot/domain";
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { AgentRunStore } from "./native-agent.js";
import { toMessage, toRun } from "./postgres-store.js";

type Database = ReturnType<typeof import("@openbot/db")["createDatabase"]>["db"];
const running = (run: Run) =>
  and(
    eq(runs.id, run.id),
    eq(runs.channelId, run.channelId),
    eq(runs.botId, run.botId),
    eq(runs.executionProfile, "none"),
    isNull(runs.nodeId),
    eq(runs.status, "running"),
  );
const membership = (run: Run) =>
  and(eq(channelBots.channelId, run.channelId), eq(channelBots.botId, run.botId));

/** Separate from Worker claims: a model can never acquire a Node or a computer profile here. */
export class PostgresAgentStore implements AgentRunStore {
  constructor(readonly db: Database) {}
  async queued(since: string): Promise<Run[]> {
    return (
      await this.db
        .select()
        .from(runs)
        .where(
          and(
            eq(runs.status, "queued"),
            eq(runs.executionProfile, "none"),
            isNull(runs.nodeId),
            gte(runs.createdAt, new Date(since)),
          ),
        )
        .orderBy(asc(runs.createdAt), asc(runs.id))
        .limit(100)
    ).map(toRun);
  }
  async claim(candidate: Run, since: string): Promise<Run | undefined> {
    return this.db.transaction(async (tx) => {
      // Serialize native claims in each channel across concurrent pollers, not just this process.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${candidate.channelId}, 731))`,
      );
      const [busy] = await tx
        .select({ id: runs.id })
        .from(runs)
        .where(
          and(
            eq(runs.channelId, candidate.channelId),
            eq(runs.executionProfile, "none"),
            eq(runs.status, "running"),
          ),
        )
        .limit(1);
      if (busy) return undefined;
      const [member] = await tx
        .select()
        .from(channelBots)
        .where(membership(candidate))
        .for("share");
      if (!member) return undefined;
      const [row] = await tx
        .update(runs)
        .set({ status: "running", updatedAt: new Date() })
        .where(
          and(
            eq(runs.id, candidate.id),
            eq(runs.channelId, candidate.channelId),
            eq(runs.botId, candidate.botId),
            eq(runs.status, "queued"),
            eq(runs.executionProfile, "none"),
            isNull(runs.nodeId),
            gte(runs.createdAt, new Date(since)),
          ),
        )
        .returning();
      if (!row) return undefined;
      await tx
        .insert(runEvents)
        .values({
          id: randomUUID(),
          runId: row.id,
          channelId: row.channelId,
          botId: row.botId,
          type: "RUN_STARTED",
          payload: { executor: "native-agent" },
        });
      return toRun(row);
    });
  }
  async assertScope(run: Run): Promise<void> {
    const [row] = await this.db
      .select({ id: runs.id })
      .from(runs)
      .innerJoin(
        channelBots,
        and(eq(channelBots.channelId, runs.channelId), eq(channelBots.botId, runs.botId)),
      )
      .where(running(run))
      .limit(1);
    if (!row) throw new Error("Agent scope revoked.");
  }
  async context(run: Run): Promise<unknown> {
    await this.assertScope(run);
    const rows = await this.db
      .select({ author: messages.authorType, content: messages.content })
      .from(messages)
      .where(
        and(
          eq(messages.channelId, run.channelId),
          lte(messages.createdAt, new Date(run.createdAt)),
        ),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(12);
    // Byte bounds also cover non-ASCII content; JSON escaping is bounded once more by the runtime.
    let remaining = 10_000;
    return rows
      .map((row) => {
        const content = Buffer.from(row.content)
          .subarray(0, Math.min(1600, remaining))
          .toString("utf8");
        remaining = Math.max(0, remaining - Buffer.byteLength(content));
        return { author: row.author, content };
      })
      .reverse();
  }
  async tasks(run: Run): Promise<unknown> {
    await this.assertScope(run);
    return this.db
      .select({ title: sql<string>`left(${runs.title}, 240)`, status: runs.status })
      .from(runs)
      .where(and(eq(runs.channelId, run.channelId), lte(runs.createdAt, new Date(run.createdAt))))
      .orderBy(desc(runs.createdAt), desc(runs.id))
      .limit(8);
  }
  async progress(run: Run, stage: string, message: string): Promise<RunProgress> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(runs)
        .set({ updatedAt: new Date() })
        .where(running(run))
        .returning();
      if (!row) throw new Error("Run is no longer active.");
      const id = randomUUID(),
        createdAt = new Date();
      await tx
        .insert(runEvents)
        .values({
          id,
          runId: run.id,
          channelId: run.channelId,
          botId: run.botId,
          type: "RUN_PROGRESS",
          payload: { stage, message },
          createdAt,
        });
      return {
        id,
        runId: run.id,
        channelId: run.channelId,
        stage,
        message,
        createdAt: createdAt.toISOString(),
      };
    });
  }
  async complete(run: Run, text: string) {
    if (!text.trim() || text.length > 8000) throw new Error("Invalid final answer.");
    return this.db.transaction(async (tx) => {
      const [member] = await tx.select().from(channelBots).where(membership(run)).for("share");
      if (!member) throw new Error("Agent scope revoked.");
      const now = new Date();
      const [row] = await tx
        .update(runs)
        .set({ status: "completed", resultSummary: text, updatedAt: now })
        .where(running(run))
        .returning();
      if (!row) throw new Error("Run is no longer active.");
      const [message] = await tx
        .insert(messages)
        .values({
          id: randomUUID(),
          channelId: row.channelId,
          authorType: "bot",
          authorId: row.botId,
          replyToMessageId: row.sourceMessageId,
          runId: row.id,
          content: text,
          createdAt: now,
        })
        .returning();
      if (!message) throw new Error("Reply was not persisted.");
      await tx.insert(runEvents).values([
        {
          id: randomUUID(),
          runId: row.id,
          channelId: row.channelId,
          botId: row.botId,
          type: "MESSAGE_CREATED",
          payload: { messageId: message.id },
        },
        {
          id: randomUUID(),
          runId: row.id,
          channelId: row.channelId,
          botId: row.botId,
          type: "RUN_COMPLETED",
          payload: { executor: "native-agent", summary: text },
        },
      ]);
      return { run: toRun(row), message: toMessage(message) };
    });
  }
  async fail(run: Run): Promise<Run | undefined> {
    return this.db.transaction(async (tx) => {
      const errorMessage =
        "Native Agent could not complete. Check model settings, channel access, and task limits before creating a new task.";
      const [row] = await tx
        .update(runs)
        .set({ status: "failed", errorMessage, updatedAt: new Date() })
        .where(running(run))
        .returning();
      if (!row) return undefined;
      await tx
        .insert(runEvents)
        .values({
          id: randomUUID(),
          runId: row.id,
          channelId: row.channelId,
          botId: row.botId,
          type: "RUN_FAILED",
          payload: {
            code: "provider_execution_failed",
            message: errorMessage,
            executor: "native-agent",
          },
        });
      return toRun(row);
    });
  }
}
