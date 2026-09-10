import { createDatabase } from "@openbot/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { PostgresAgentStore } from "./postgres-agent-store.js";
import { PostgresControlPlaneStore } from "./postgres-store.js";
import { NativeAgentRunner } from "./native-agent.js";
import { ChannelRealtimeHub } from "./channel-realtime-hub.js";
import type { ModelSettingsService } from "./model-settings.js";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Required collaboration fixture is missing.");
  return value;
}

const url = process.env.OPENBOT_COLLAB_TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !/^\/openbot_collab_test_[a-z0-9_]+$/.test(target.pathname)
  )
    throw new Error(
      "Collaboration tests require a disposable loopback openbot_collab_test_* database.",
    );
}
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 10, text: 10, reasoning: 0 },
};
const answer = (text: string) => ({
  content: [{ type: "text" as const, text }],
  usage,
  finishReason: { unified: "stop" as const, raw: "stop" },
  warnings: [],
});
const call = (toolName: string, input: unknown) => ({
  content: [
    { type: "tool-call" as const, toolCallId: "delegate", toolName, input: JSON.stringify(input) },
  ],
  usage,
  finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
  warnings: [],
});

describe.skipIf(!url)("PostgreSQL channel Bot collaboration", () => {
  const database = url ? createDatabase(url) : undefined;
  const peer = url ? createDatabase(url) : undefined;
  beforeAll(async () => {
    await database?.migrate();
  });
  beforeEach(async () => {
    if (database) {
      await database.client`set client_min_messages = warning`;
      await database.client`truncate bots, channels cascade`;
    }
  });
  afterAll(async () => {
    await Promise.all([database?.close(), peer?.close()]);
  });
  async function fixture() {
    if (!database || !peer) throw new Error("Missing fixture database.");
    const control = new PostgresControlPlaneStore(database.db);
    const native = new PostgresAgentStore(database.db),
      other = new PostgresAgentStore(peer.db);
    const members = await Promise.all(
      ["Coordinator", "Researcher", "Reviewer", "Writer"].map((name) =>
        control.createBot({ name, role: name, computerProfile: "none" }),
      ),
    );
    const channel = await control.createChannel({
      name: "Collaboration",
      description: "fixture",
      botIds: members.map((bot) => bot.id),
    });
    const { run: queued } = await control.submitTask(channel.id, {
      content: "Research and summarize",
      botId: required(members[0]).id,
    });
    const since = new Date(Date.now() - 60_000).toISOString();
    const root = await native.claim(queued, since);
    if (!root) throw new Error("Failed to claim root.");
    return { control, native, other, members, channel, root, since };
  }
  it("binds author and recipient identities, persists provenance, and retains the root channel lease", async () => {
    const f = await fixture();
    const child = await f.native.delegate(f.root, {
      botId: required(f.members[1]).id,
      task: "Find facts",
    });
    expect(child.message).toMatchObject({
      authorType: "bot",
      authorId: f.root.botId,
      channelId: f.channel.id,
    });
    expect(child.run).toMatchObject({
      botId: required(f.members[1]).id,
      parentRunId: f.root.id,
      rootRunId: f.root.id,
      delegatedByBotId: f.root.botId,
      sourceMessageId: child.message.id,
      status: "running",
    });
    expect(await f.native.profile(child.run)).toMatchObject({
      name: "Researcher",
      role: "Researcher",
    });
    const next = await f.control.submitTask(f.channel.id, { content: "Next human task" });
    expect(await f.other.claim(next.run, f.since)).toBeUndefined();
    const completed = await f.native.complete(child.run, "Verified result");
    expect(completed.message).toMatchObject({
      authorId: required(f.members[1]).id,
      runId: child.run.id,
      replyToMessageId: child.message.id,
    });
    await f.native.complete(f.root, "Synthesis");
    expect(await f.other.claim(next.run, f.since)).toMatchObject({ status: "running" });
  });
  it("rejects spoofed callers, nonmembers, cycles and depth overflow", async () => {
    const f = await fixture();
    await expect(
      f.native.delegate(
        { ...f.root, botId: required(f.members[1]).id },
        { botId: required(f.members[2]).id, task: "Spoof" },
      ),
    ).rejects.toThrow();
    const outsider = await f.control.createBot({
      name: "Outsider",
      role: "External",
      computerProfile: "none",
    });
    await expect(
      f.native.delegate(f.root, { botId: outsider.id, task: "Outside" }),
    ).rejects.toThrow();
    const child = await f.native.delegate(f.root, {
      botId: required(f.members[1]).id,
      task: "Research",
    });
    await expect(
      f.native.delegate(child.run, { botId: f.root.botId, task: "Loop" }),
    ).rejects.toThrow();
    const grandchild = await f.native.delegate(child.run, {
      botId: required(f.members[2]).id,
      task: "Review",
    });
    await expect(
      f.native.delegate(grandchild.run, { botId: required(f.members[3]).id, task: "Too deep" }),
    ).rejects.toThrow();
    expect((await f.native.colleagues(child.run)).bots.map((bot) => bot.id)).not.toContain(
      f.root.botId,
    );
  });
  it("enforces the four-descendant cap across concurrent Server transactions", async () => {
    const f = await fixture();
    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        (i % 2 ? f.native : f.other).delegate(f.root, {
          botId: required(f.members[1]).id,
          task: `Assignment ${i}`,
        }),
      ),
    );
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(4);
    const rows = await required(database)
      .client`select id from runs where root_run_id = ${f.root.id}`;
    expect(rows).toHaveLength(4);
  });
  it("revokes a child's tools and completion when its parent is cancelled", async () => {
    const f = await fixture();
    const child = await f.native.delegate(f.root, {
      botId: required(f.members[1]).id,
      task: "Research",
    });
    await f.native.cancel(f.root.id);
    await expect(f.native.assertScope(child.run)).rejects.toThrow();
    await expect(f.native.complete(child.run, "Late reply")).rejects.toThrow();
    expect(
      (await f.control.listMessages(f.channel.id)).some(
        (message) => message.content === "Late reply",
      ),
    ).toBe(false);
  });
  it("runs a recipient with its own profile and returns its result to the parent model", async () => {
    const f = await fixture();
    // Runner owns claims, so return this fixture's root to the queue before starting it.
    await required(database).client`update runs set status = 'queued' where id = ${f.root.id}`;
    const parentModel = new MockLanguageModelV4({
      doGenerate: [
        call("list_channel_bots", {}),
        call("delegate_task", { botId: required(f.members[1]).id, task: "Find release facts" }),
        answer("Coordinator synthesis"),
      ],
    });
    const childModel = new MockLanguageModelV4({ doGenerate: answer("Researcher evidence") });
    const settings = {
      agentSettings: async () => ({
        provider: "openai",
        model: "fixture",
        apiKey: "fixture",
        revision: "1",
        agentEnabledAt: f.since,
      }),
      onChange: () => () => {},
    } as unknown as ModelSettingsService;
    const errors = vi.fn();
    let models = 0;
    const runner = new NativeAgentRunner(
      f.native,
      settings,
      new ChannelRealtimeHub(),
      errors,
      () => (models++ === 0 ? parentModel : childModel),
      { webSearch: () => undefined },
    );
    runner.start();
    try {
      await vi.waitFor(
        async () => {
          expect(
            (await f.control.listRuns(f.channel.id)).find((run) => run.id === f.root.id)?.status,
          ).toBe("completed");
        },
        { timeout: 10_000 },
      );
      const messages = await f.control.listMessages(f.channel.id);
      expect(messages.find((message) => message.content === "Researcher evidence")?.authorId).toBe(
        required(f.members[1]).id,
      );
      expect(
        messages.find((message) => message.content === "Coordinator synthesis")?.authorId,
      ).toBe(f.root.botId);
      expect(JSON.stringify(childModel.doGenerateCalls[0]?.prompt)).toContain("Researcher");
      expect(JSON.stringify(parentModel.doGenerateCalls.at(-1)?.prompt)).toContain(
        "Researcher evidence",
      );
      expect(errors).not.toHaveBeenCalled();
    } finally {
      await runner.stop();
    }
  });
  it("does not complete a parent while delegated work is still running", async () => {
    const f = await fixture();
    await f.native.delegate(f.root, { botId: required(f.members[1]).id, task: "Still working" });
    await expect(f.native.complete(f.root, "Premature synthesis")).rejects.toThrow();
    expect(
      (await f.control.listRuns(f.channel.id)).find((run) => run.id === f.root.id)?.status,
    ).toBe("running");
    expect(
      (await f.control.listMessages(f.channel.id)).some(
        (message) => message.content === "Premature synthesis",
      ),
    ).toBe(false);
  });
  it("ends active descendants when a parent fails and cannot bypass ancestry with omitted caller metadata", async () => {
    const f = await fixture();
    const child = await f.native.delegate(f.root, {
      botId: required(f.members[1]).id,
      task: "Research",
    });
    await f.native.fail(f.root);
    const stripped = {
      ...child.run,
      parentRunId: undefined,
      rootRunId: undefined,
      delegatedByBotId: undefined,
    } as unknown as typeof child.run;
    await expect(f.native.assertScope(stripped)).rejects.toThrow();
    await expect(f.native.complete(stripped, "Late child result")).rejects.toThrow();
    expect(
      (await f.control.listRuns(f.channel.id)).find((run) => run.id === child.run.id)?.status,
    ).not.toBe("running");
    const next = await f.control.submitTask(f.channel.id, { content: "New root" });
    expect(await f.other.claim(next.run, f.since)).toMatchObject({ status: "running" });
  });
  it("loads parent message identity and allowed attachment references from Server records", async () => {
    const f = await fixture();
    const allowedId = "00000000-0000-4000-8000-000000000081";
    const unlistedId = "00000000-0000-4000-8000-000000000082";
    await required(database)
      .client`update runs set instruction = ${`Read [OpenBot attachment: ${allowedId}]`} where id = ${f.root.id}`;
    const other = await f.control.submitTask(f.channel.id, { content: "Unrelated source" });
    const caller = {
      ...f.root,
      sourceMessageId: other.message.id,
      instruction: `[OpenBot attachment: ${unlistedId}]`,
    };
    const child = await f.native.delegate(caller, {
      botId: required(f.members[1]).id,
      task: `Read [OpenBot attachment: ${allowedId}]`,
    });
    expect(child.message.replyToMessageId).toBe(f.root.sourceMessageId);
    await expect(
      f.native.delegate(caller, {
        botId: required(f.members[1]).id,
        task: `Read [OpenBot attachment: ${unlistedId}]`,
      }),
    ).rejects.toThrow();
  });
  it("terminates a newly created child when delegation progress fails before its model starts", async () => {
    const f = await fixture();
    await required(database).client`update runs set status = 'queued' where id = ${f.root.id}`;
    const progress = f.native.progress.bind(f.native);
    vi.spyOn(f.native, "progress").mockImplementation(async (run, stage, message) => {
      if (stage === "delegation") throw new Error("Fixture progress write failure");
      return progress(run, stage, message);
    });
    const model = new MockLanguageModelV4({
      doGenerate: [
        call("delegate_task", { botId: required(f.members[1]).id, task: "Research" }),
        answer("Unused answer"),
      ],
    });
    const settings = {
      agentSettings: async () => ({
        provider: "openai",
        model: "fixture",
        apiKey: "fixture",
        revision: "1",
        agentEnabledAt: f.since,
      }),
      onChange: () => () => {},
    } as unknown as ModelSettingsService;
    const runner = new NativeAgentRunner(
      f.native,
      settings,
      new ChannelRealtimeHub(),
      vi.fn(),
      () => model,
      { webSearch: () => undefined },
    );
    runner.start();
    try {
      await vi.waitFor(
        async () =>
          expect(
            (await f.control.listRuns(f.channel.id)).find((run) => run.id === f.root.id)?.status,
          ).toBe("failed"),
        { timeout: 10000 },
      );
      const allRuns = await f.control.listRuns(f.channel.id);
      expect(allRuns).toHaveLength(2);
      expect(allRuns.every((run) => run.status !== "running")).toBe(true);
    } finally {
      await runner.stop();
    }
  });

  it("checks persisted ancestry even when the caller strips optional delegation fields", async () => {
    const f = await fixture();
    const child = await f.native.delegate(f.root, {
      botId: required(f.members[1]).id,
      task: "Research",
    });
    // Simulate a terminal ancestor from an interrupted older Server without trusting caller shape.
    await required(database).client`update runs set status = 'failed' where id = ${f.root.id}`;
    const {
      parentRunId: _parent,
      rootRunId: _root,
      delegatedByBotId: _by,
      ...stripped
    } = child.run;
    await expect(f.native.assertScope(stripped)).rejects.toThrow();
    await expect(f.native.complete(stripped, "Late result")).rejects.toThrow();
  });
  it("propagates parent abort into a running child and publishes its durable cancelled state", async () => {
    const f = await fixture();
    await required(database).client`update runs set status = 'queued' where id = ${f.root.id}`;
    let childStarted = false;
    let childAborted = false;
    const parentModel = new MockLanguageModelV4({
      doGenerate: [
        call("delegate_task", { botId: required(f.members[1]).id, task: "Wait for research" }),
        answer("Unused"),
      ],
    });
    const childModel = new MockLanguageModelV4({
      doGenerate: async ({ abortSignal }) => {
        childStarted = true;
        return new Promise((_resolve, reject) => {
          const abort = () => {
            childAborted = true;
            reject(abortSignal?.reason ?? new Error("aborted"));
          };
          if (abortSignal?.aborted) abort();
          else abortSignal?.addEventListener("abort", abort, { once: true });
        });
      },
    });
    const settings = {
      agentSettings: async () => ({
        provider: "openai",
        model: "fixture",
        apiKey: "fixture",
        revision: "1",
        agentEnabledAt: f.since,
      }),
      onChange: () => () => {},
    } as unknown as ModelSettingsService;
    const events: Array<{ id: string; status: string }> = [];
    const realtime = new ChannelRealtimeHub();
    const unsubscribe = realtime.subscribe(f.channel.id, (event) => {
      if (event.type === "run.updated") events.push({ id: event.run.id, status: event.run.status });
    });
    let models = 0;
    const runner = new NativeAgentRunner(
      f.native,
      settings,
      realtime,
      vi.fn(),
      () => (models++ === 0 ? parentModel : childModel),
      { webSearch: () => undefined },
    );
    runner.start();
    try {
      await vi.waitFor(() => expect(childStarted).toBe(true), { timeout: 10000 });
      const { descendants } = await f.native.cancelWithDescendants(f.root.id);
      expect(descendants).toHaveLength(1);
      runner.cancel(f.root.id);
      await vi.waitFor(
        () => {
          expect(childAborted).toBe(true);
          expect(
            events.some(
              (event) => event.id === required(descendants[0]).id && event.status === "cancelled",
            ),
          ).toBe(true);
        },
        { timeout: 10000 },
      );
      expect(
        (await f.control.listRuns(f.channel.id)).every((run) => run.status === "cancelled"),
      ).toBe(true);
    } finally {
      await runner.stop();
      unsubscribe();
    }
  });
});
