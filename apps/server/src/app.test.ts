import type {
  Bot,
  Channel,
  CreateBotInput,
  CreateChannelInput,
  CreateMessageInput,
  ExecutionNode,
  Message,
  Run,
} from "@openbot/domain";
import { describe, expect, it, vi } from "vitest";
import { ChannelRealtimeHub } from "./channel-realtime-hub.js";
import {
  StoreNotFoundError,
  StoreValidationError,
  type ControlPlaneStore,
} from "./control-plane-store.js";
import { createApp, ownerSessionCookie } from "./app.js";
import { OwnerAuthService } from "./owner-auth.js";
import type {
  CreateOwnerSessionInput,
  OwnerSessionStore,
  StoredOwnerSession,
} from "./session-store.js";
import { selectChannelAssignee } from "./task-routing.js";

const testOrigin = "http://localhost:5173";

describe("server app", () => {
  it("reports M1 health", async () => {
    const app = createTestApp({ store: createTestStore() });
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, phase: "m1" });
  });

  it("reports an anonymous session and protects control-plane data", async () => {
    const app = createTestApp({ store: createTestStore() });

    const session = await app.request("/api/v1/auth/session");
    expect(await session.json()).toEqual({ authenticated: false });

    const workspace = await app.request("/api/v1/workspace");
    expect(workspace.status).toBe(401);
    expect(await workspace.json()).toEqual({ error: "Authentication required." });
  });

  it("creates and revokes an HttpOnly owner session", async () => {
    const app = createTestApp({ store: createTestStore() });

    const rejected = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: testOrigin },
      body: JSON.stringify({ password: "incorrect-password" }),
    });
    expect(rejected.status).toBe(401);
    expect(rejected.headers.get("set-cookie")).toBeNull();

    const cookie = await login(app);
    expect(cookie).toContain(`${ownerSessionCookie}=`);

    const active = await app.request("/api/v1/auth/session", {
      headers: { Cookie: cookie },
    });
    expect(await active.json()).toMatchObject({
      authenticated: true,
      owner: { id: "owner", name: "Test Owner" },
    });

    const logout = await app.request("/api/v1/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie, Origin: testOrigin },
    });
    expect(logout.status).toBe(204);

    const revoked = await app.request("/api/v1/auth/session", {
      headers: { Cookie: cookie },
    });
    expect(await revoked.json()).toEqual({ authenticated: false });
  });

  it("rejects mutations without a trusted Origin", async () => {
    const app = createTestApp({ store: createTestStore() });
    const response = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "correct-owner-password" }),
    });
    expect(response.status).toBe(403);
  });

  it("projects persisted and connected counts into workspace", async () => {
    const store = createTestStore();
    await store.createBot({ name: "Ops", role: "Operations", computerProfile: "docker-linux" });
    const app = createTestApp({
      listNodes: () => [
        {
          id: "node-1",
          name: "Linux worker",
          platform: "linux",
          capabilities: ["browser"],
          activeRunIds: [],
          maxConcurrentRuns: 1,
          connectedAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      store,
    });
    const cookie = await login(app);
    const response = await app.request("/api/v1/workspace", { headers: { Cookie: cookie } });

    expect(await response.json()).toMatchObject({
      counts: { bots: 1, channels: 0, connectedNodes: 1 },
    });
  });

  it("creates a Bot through the validated API", async () => {
    const app = createTestApp({ store: createTestStore() });
    const cookie = await login(app);
    const response = await app.request("/api/v1/bots", {
      method: "POST",
      headers: authenticatedHeaders(cookie),
      body: JSON.stringify({
        name: "Ops",
        role: "Browser and operations",
        computerProfile: "docker-linux",
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      bot: { name: "Ops", status: "idle", computerProfile: "docker-linux" },
    });
  });

  it("rejects invalid Bot input before reaching storage", async () => {
    const app = createTestApp({ store: createTestStore() });
    const cookie = await login(app);
    const response = await app.request("/api/v1/bots", {
      method: "POST",
      headers: authenticatedHeaders(cookie),
      body: JSON.stringify({ name: "", role: "", computerProfile: "root-shell" }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: "Please correct the highlighted fields.",
    });
  });

  it("creates a channel with a selected Bot", async () => {
    const store = createTestStore();
    const bot = await store.createBot({
      name: "Chief",
      role: "Coordinator",
      computerProfile: "none",
    });
    const app = createTestApp({ store });
    const cookie = await login(app);
    const response = await app.request("/api/v1/channels", {
      method: "POST",
      headers: authenticatedHeaders(cookie),
      body: JSON.stringify({
        name: "运营中心",
        description: "日常运营工作",
        botIds: [bot.id],
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      channel: { name: "运营中心", botIds: [bot.id] },
    });
  });

  it("stores and lists a local channel message", async () => {
    const store = createTestStore();
    const bot = await store.createBot({
      name: "Ops",
      role: "日常运营",
      computerProfile: "docker-linux",
    });
    const channel = await store.createChannel({
      name: "运营中心",
      description: "日常任务",
      botIds: [bot.id],
    });
    const dispatchRun = vi.fn();
    const app = createTestApp({ dispatchRun, store });
    const cookie = await login(app);

    const created = await app.request(`/api/v1/channels/${channel.id}/messages`, {
      method: "POST",
      headers: authenticatedHeaders(cookie),
      body: JSON.stringify({ content: "  打开测试页并截图  " }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      message: { channelId: channel.id, authorType: "human", content: "打开测试页并截图" },
      run: {
        channelId: channel.id,
        botId: bot.id,
        title: "打开测试页并截图",
        status: "queued",
      },
    });
    expect(dispatchRun).toHaveBeenCalledWith(
      expect.objectContaining({ botId: bot.id, executionProfile: "docker-linux" }),
    );

    const listed = await app.request(`/api/v1/channels/${channel.id}/messages`, {
      headers: { Cookie: cookie },
    });
    expect(await listed.json()).toMatchObject({
      messages: [{ content: "打开测试页并截图" }],
    });

    const listedRuns = await app.request(`/api/v1/channels/${channel.id}/runs`, {
      headers: { Cookie: cookie },
    });
    expect(await listedRuns.json()).toMatchObject({
      runs: [{ botId: bot.id, status: "queued", title: "打开测试页并截图" }],
    });
  });

  it("rejects a task when the channel has no Bot", async () => {
    const store = createTestStore();
    const channel = await store.createChannel({
      name: "空频道",
      description: "还没有成员",
      botIds: [],
    });
    const app = createTestApp({ store });
    const cookie = await login(app);

    const response = await app.request(`/api/v1/channels/${channel.id}/messages`, {
      method: "POST",
      headers: authenticatedHeaders(cookie),
      body: JSON.stringify({ content: "现在执行任务" }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "Add a Bot to this channel before assigning a task.",
    });
  });

  it("prefers Chief and rejects an explicit Bot outside the channel", async () => {
    const store = createTestStore();
    const ops = await store.createBot({
      name: "Ops",
      role: "日常运营",
      computerProfile: "docker-linux",
    });
    const chief = await store.createBot({
      name: "Chief",
      role: "任务协调",
      computerProfile: "none",
    });
    const outsider = await store.createBot({
      name: "Coder",
      role: "代码开发",
      computerProfile: "docker-linux",
    });
    const channel = await store.createChannel({
      name: "运营中心",
      description: "日常任务",
      botIds: [ops.id, chief.id],
    });
    const app = createTestApp({ store });
    const cookie = await login(app);

    const routed = await app.request(`/api/v1/channels/${channel.id}/messages`, {
      method: "POST",
      headers: authenticatedHeaders(cookie),
      body: JSON.stringify({ content: "汇总今日任务" }),
    });
    expect(routed.status).toBe(201);
    expect(await routed.json()).toMatchObject({ run: { botId: chief.id } });

    const rejected = await app.request(`/api/v1/channels/${channel.id}/messages`, {
      method: "POST",
      headers: authenticatedHeaders(cookie),
      body: JSON.stringify({ content: "绕过频道分派", botId: outsider.id }),
    });
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toEqual({
      error: "The selected Bot is not a member of this channel.",
    });
  });

  it("returns 404 when reading messages from an unknown channel", async () => {
    const app = createTestApp({ store: createTestStore() });
    const cookie = await login(app);
    const response = await app.request(
      "/api/v1/channels/00000000-0000-4000-8000-000000000099/messages",
      { headers: { Cookie: cookie } },
    );
    expect(response.status).toBe(404);
  });

  it("opens a channel event stream and publishes persisted messages", async () => {
    const store = createTestStore();
    const bot = await store.createBot({
      name: "Ops",
      role: "日常运营",
      computerProfile: "docker-linux",
    });
    const channel = await store.createChannel({
      name: "实时频道",
      description: "多设备同步",
      botIds: [bot.id],
    });
    const realtime = new ChannelRealtimeHub();
    const published: Message[] = [];
    const publishedRuns: Run[] = [];
    const unsubscribe = realtime.subscribe(channel.id, (event) => {
      if (event.type === "message.created") published.push(event.message);
      if (event.type === "run.created") publishedRuns.push(event.run);
    });
    const app = createTestApp({ realtime, store });
    const cookie = await login(app);
    const controller = new AbortController();
    const response = await app.request(`/api/v1/channels/${channel.id}/events`, {
      headers: { Cookie: cookie },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const firstChunk = await reader?.read();
    expect(new TextDecoder().decode(firstChunk?.value)).toContain("event: channel.ready");

    const created = await app.request(`/api/v1/channels/${channel.id}/messages`, {
      method: "POST",
      headers: authenticatedHeaders(cookie),
      body: JSON.stringify({ content: "同步给其他设备" }),
    });
    expect(created.status).toBe(201);
    expect(published).toMatchObject([{ channelId: channel.id, content: "同步给其他设备" }]);
    expect(publishedRuns).toMatchObject([
      { channelId: channel.id, botId: bot.id, status: "queued" },
    ]);
    const messageChunk = await reader?.read();
    const messageEvent = new TextDecoder().decode(messageChunk?.value);
    expect(messageEvent).toContain("event: message.created");
    expect(messageEvent).toContain("同步给其他设备");
    const runEvent = messageEvent.includes("event: run.created")
      ? messageEvent
      : new TextDecoder().decode((await reader?.read())?.value);
    expect(runEvent).toContain("event: run.created");
    expect(runEvent).toContain('"status":"queued"');

    await reader?.cancel();
    controller.abort();
    unsubscribe();
  });

  it("rejects an event stream for an unknown channel", async () => {
    const app = createTestApp({ store: createTestStore() });
    const cookie = await login(app);
    const response = await app.request(
      "/api/v1/channels/00000000-0000-4000-8000-000000000099/events",
      { headers: { Cookie: cookie } },
    );
    expect(response.status).toBe(404);
  });
});

function createTestApp({
  store,
  dispatchRun,
  listNodes = () => [],
  realtime,
}: {
  store: ControlPlaneStore;
  dispatchRun?: (run: Run) => void;
  listNodes?: () => ExecutionNode[];
  realtime?: ChannelRealtimeHub;
}) {
  const auth = new OwnerAuthService(createMemorySessionStore(), {
    ownerName: "Test Owner",
    ownerPassword: "correct-owner-password",
    sessionTtlMs: 60_000,
  });
  return createApp({
    allowedOrigins: [testOrigin],
    auth,
    ...(dispatchRun === undefined ? {} : { dispatchRun }),
    listNodes,
    ...(realtime === undefined ? {} : { realtime }),
    secureCookies: false,
    store,
  });
}

async function login(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await app.request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: testOrigin },
    body: JSON.stringify({ password: "correct-owner-password" }),
  });
  expect(response.status).toBe(200);
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Strict");
  expect(setCookie).not.toContain("Secure");
  if (setCookie === null) throw new Error("Login did not set an owner session cookie.");
  return setCookie.split(";", 1)[0] ?? "";
}

function authenticatedHeaders(cookie: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Cookie: cookie,
    Origin: testOrigin,
  };
}

function createMemorySessionStore(): OwnerSessionStore {
  const sessions: Array<StoredOwnerSession & { revokedAt?: Date }> = [];
  return {
    async createSession(input: CreateOwnerSessionInput) {
      const session = { ...input };
      sessions.push(session);
      return session;
    },
    async findActiveSession(tokenDigest: string, now: Date) {
      return sessions.find(
        (session) =>
          session.tokenDigest === tokenDigest &&
          session.revokedAt === undefined &&
          session.expiresAt > now,
      );
    },
    async revokeSession(tokenDigest: string, now: Date) {
      const session = sessions.find((item) => item.tokenDigest === tokenDigest);
      if (session !== undefined) session.revokedAt = now;
    },
  };
}

function createTestStore(): ControlPlaneStore {
  const bots: Bot[] = [];
  const channels: Channel[] = [];
  const messages: Message[] = [];
  const runs: Run[] = [];
  let nextId = 0;
  const id = () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`;

  return {
    async channelExists(channelId: string) {
      return channels.some((channel) => channel.id === channelId);
    },
    async listBots() {
      return bots;
    },
    async listChannels() {
      return channels;
    },
    async listMessages(channelId: string) {
      if (!channels.some((channel) => channel.id === channelId)) {
        throw new StoreNotFoundError("Channel not found.");
      }
      return messages.filter((message) => message.channelId === channelId);
    },
    async listRuns(channelId?: string) {
      if (channelId !== undefined && !channels.some((channel) => channel.id === channelId)) {
        throw new StoreNotFoundError("Channel not found.");
      }
      return channelId === undefined ? runs : runs.filter((run) => run.channelId === channelId);
    },
    async listDispatchableRuns(limit = 50) {
      return runs
        .filter(
          (run) =>
            run.status === "queued" && run.nodeId === undefined && run.executionProfile !== "none",
        )
        .slice(0, limit);
    },
    async getCounts() {
      return { bots: bots.length, channels: channels.length, activeRuns: runs.length };
    },
    async createBot(input: CreateBotInput) {
      const bot: Bot = {
        id: id(),
        ...input,
        status: "idle",
        createdAt: new Date().toISOString(),
      };
      bots.push(bot);
      return bot;
    },
    async createChannel(input: CreateChannelInput) {
      const channel: Channel = {
        id: id(),
        ...input,
        createdAt: new Date().toISOString(),
      };
      channels.push(channel);
      return channel;
    },
    async submitTask(channelId: string, input: CreateMessageInput) {
      const channel = channels.find((item) => item.id === channelId);
      if (channel === undefined) {
        throw new StoreNotFoundError("Channel not found.");
      }
      const candidates = channel.botIds
        .map((botId) => bots.find((bot) => bot.id === botId))
        .filter((bot): bot is Bot => bot !== undefined);
      const assignee = selectChannelAssignee(candidates, input.botId);
      if (assignee === undefined) {
        throw new StoreValidationError(
          input.botId === undefined
            ? "Add a Bot to this channel before assigning a task."
            : "The selected Bot is not a member of this channel.",
        );
      }
      const message: Message = {
        id: id(),
        channelId,
        authorType: "human",
        content: input.content,
        createdAt: new Date().toISOString(),
      };
      messages.push(message);
      const run: Run = {
        id: id(),
        channelId,
        botId: assignee.id,
        sourceMessageId: message.id,
        executionProfile: assignee.computerProfile,
        title: input.content,
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      runs.push(run);
      return { message, run };
    },
    async assignRun(runId: string, nodeId: string) {
      const run = runs.find((item) => item.id === runId);
      if (run === undefined || run.status !== "queued" || run.nodeId !== undefined) {
        return undefined;
      }
      run.nodeId = nodeId;
      run.status = "assigned";
      run.updatedAt = new Date().toISOString();
      return run;
    },
    async requeueAssignedRuns(nodeId?: string) {
      const requeued = runs.filter(
        (run) => run.status === "assigned" && (nodeId === undefined || run.nodeId === nodeId),
      );
      for (const run of requeued) {
        delete run.nodeId;
        run.status = "queued";
        run.updatedAt = new Date().toISOString();
      }
      return requeued;
    },
    async upsertNode() {},
    async markNodeOffline() {},
    async joinBotToChannel(channelId: string, botId: string) {
      const channel = channels.find((item) => item.id === channelId);
      if (channel === undefined) {
        throw new Error("Channel not found.");
      }
      if (!channel.botIds.includes(botId)) {
        channel.botIds.push(botId);
      }
      return channel;
    },
  };
}
