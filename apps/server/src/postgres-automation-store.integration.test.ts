import { randomUUID } from "node:crypto";
import { createDatabase } from "@openbot/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgresAutomationStore } from "./postgres-automation-store.js";
import { PostgresControlPlaneStore } from "./postgres-store.js";

const databaseUrl = process.env.OPENBOT_AUTOMATION_TEST_DATABASE_URL;
// Destructive fixture cleanup is allowed only in an explicitly named disposable loopback database.
if (databaseUrl) {
  const target = new URL(databaseUrl);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !/^\/openbot_automation_test_[a-z0-9_]+$/.test(target.pathname)
  ) {
    throw new Error(
      "Automation integration tests require a dedicated loopback openbot_automation_test_* database.",
    );
  }
}

describe.skipIf(!databaseUrl)("PostgreSQL automation transaction", () => {
  const database = databaseUrl ? createDatabase(databaseUrl) : undefined;
  const peer = databaseUrl ? createDatabase(databaseUrl) : undefined;
  const store = database ? new PostgresAutomationStore(database.db) : undefined;
  const peerStore = peer ? new PostgresAutomationStore(peer.db) : undefined;
  beforeAll(async () => {
    await database?.migrate();
  });
  beforeEach(async () => {
    if (!database) return;
    await database.client`truncate bots, channels cascade`;
    await database.client`insert into bots (id,name,role,computer_profile) values ('test-bot','Test Bot','Assistant','none')`;
    await database.client`insert into channels (id,name) values ('test-channel','automation-test')`;
    await database.client`insert into channel_bots (channel_id,bot_id) values ('test-channel','test-bot')`;
  });
  afterAll(async () => {
    await Promise.all([database?.close(), peer?.close()]);
  });
  const command = () => ({
    name: "Scheduled check",
    channelId: "test-channel",
    botId: "test-bot",
    prompt: "Review the channel",
    intervalMinutes: 60,
    firstRunAt: new Date(Date.now() + 3600_000).toISOString(),
  });
  async function makeDue(id: string) {
    if (!database) return;
    await database.client`update automations set next_run_at=now()-interval '2 days' where id=${id}`;
  }

  it("competing processes create one normal queued Run and advance directly beyond downtime", async () => {
    if (!store || !peerStore || !database) return;
    const schedule = await store.create(command());
    await makeDue(schedule.id);
    const results = await Promise.all([
      store.submitDue(),
      peerStore.submitDue(),
      store.submitDue(),
    ]);
    expect(results.flat()).toHaveLength(1);
    expect(results.flat()[0]?.message.authorType).toBe("system");
    const [next] = await peerStore.list();
    expect(next?.lastOutcome).toBe("submitted");
    expect(new Date(next?.nextRunAt ?? "").getTime()).toBeGreaterThan(Date.now());
    expect(results.flat()[0]?.run).toMatchObject({
      botId: "test-bot",
      channelId: "test-channel",
      executionProfile: "none",
      status: "queued",
      instruction: "Review the channel",
    });
    const [counts] =
      await database.client`select (select count(*) from messages)::integer as messages, (select count(*) from runs)::integer as runs, (select count(*) from run_events where type='AUTOMATION_OCCURRENCE')::integer as occurrences`;
    expect(counts).toEqual({ messages: 1, runs: 1, occurrences: 1 });
    const [event] =
      await database.client`select run_id, payload from run_events where type='AUTOMATION_OCCURRENCE'`;
    expect(event?.payload.automationId).toBe(schedule.id);
    expect(event?.run_id).toBe(next?.lastRunId);
  });

  it("rolls back source Message, Run, audit and timestamp together, then retries exactly once", async () => {
    if (!store || !database) return;
    const schedule = await store.create(command());
    await makeDue(schedule.id);
    await database.client`alter table automations add constraint test_force_rollback check (last_outcome is distinct from 'submitted')`;
    try {
      await expect(store.submitDue()).rejects.toThrow();
      expect((await store.list())[0]?.lastRunId).toBeNull();
      const [counts] =
        await database.client`select (select count(*) from messages)::integer as messages, (select count(*) from runs)::integer as runs`;
      expect(counts).toEqual({ messages: 0, runs: 0 });
    } finally {
      await database.client`alter table automations drop constraint test_force_rollback`;
    }
    expect(await store.submitDue()).toHaveLength(1);
    expect(await store.submitDue()).toHaveLength(0);
  });

  it("skips an unfinished previous Run, preserves it on pause/delete, and resumes in the future", async () => {
    if (!store || !database) return;
    const schedule = await store.create(command());
    await makeDue(schedule.id);
    const [submitted] = await store.submitDue();
    await makeDue(schedule.id);
    expect(await store.submitDue()).toHaveLength(0);
    expect((await store.list())[0]?.lastOutcome).toBe("skipped_active");
    await store.setEnabled(schedule.id, false);
    await makeDue(schedule.id);
    expect(await store.submitDue()).toHaveLength(0);
    const resumed = await store.setEnabled(schedule.id, true);
    expect(new Date(resumed.nextRunAt).getTime()).toBeGreaterThan(Date.now());
    await store.delete(schedule.id);
    const [run] =
      await database.client`select status from runs where id=${submitted?.run.id ?? ""}`;
    expect(run?.status).toBe("queued");
    expect(await store.list()).toHaveLength(0);
  });

  it("pauses missing membership without switching Bot and revalidates membership on resume", async () => {
    if (!store || !database) return;
    await expect(store.create({ ...command(), botId: "other" })).rejects.toThrow("belong");
    const schedule = await store.create(command());
    await makeDue(schedule.id);
    await database.client`delete from channel_bots where bot_id='test-bot'`;
    expect(await store.submitDue()).toHaveLength(0);
    expect((await store.list())[0]).toMatchObject({
      enabled: false,
      lastOutcome: "target_unavailable",
      lastRunId: null,
    });
    await expect(store.setEnabled(schedule.id, true)).rejects.toThrow("belong");
  });

  it("reuses interactive task membership and source-Run semantics", async () => {
    if (!database) return;
    const interactive = new PostgresControlPlaneStore(database.db);
    await expect(
      interactive.submitTask("test-channel", { content: "Test", botId: "missing" }),
    ).rejects.toThrow("member");
    const task = await interactive.submitTask("test-channel", {
      content: "Test",
      botId: "test-bot",
    });
    expect(task.message.authorType).toBe("human");
    expect(task.message.runId).toBe(task.run.id);
    expect(task.run.sourceMessageId).toBe(task.message.id);
  });

  it("bounds start dates and serializes the 50-record limit", async () => {
    if (!store || !peerStore || !database) return;
    await expect(
      store.create({ ...command(), firstRunAt: "2020-01-01T00:00:00Z" }),
    ).rejects.toThrow("366 days");
    await expect(
      store.create({ ...command(), firstRunAt: "2200-01-01T00:00:00Z" }),
    ).rejects.toThrow("366 days");
    const rows = Array.from({ length: 49 }, () => ({
      id: randomUUID(),
      name: "Test",
      channel_id: "test-channel",
      bot_id: "test-bot",
      prompt: "Check",
      interval_minutes: 60,
      next_run_at: new Date(Date.now() + 3600_000).toISOString(),
    }));
    await database.client`insert into automations ${database.client(rows)}`;
    const attempts = await Promise.allSettled([
      store.create(command()),
      peerStore.create(command()),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await store.list()).toHaveLength(50);
  });
});
