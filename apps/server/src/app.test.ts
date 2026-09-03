import type {
  Bot,
  Channel,
  CreateBotInput,
  CreateChannelInput,
  CreateMessageInput,
  Message,
} from "@openbot/domain";
import { describe, expect, it } from "vitest";
import { ChannelRealtimeHub } from "./channel-realtime-hub.js";
import { StoreNotFoundError, type ControlPlaneStore } from "./control-plane-store.js";
import { createApp } from "./app.js";

describe("server app", () => {
  it("reports M0 health", async () => {
    const app = createApp({ listNodes: () => [], store: createTestStore() });
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, phase: "m0" });
  });

  it("projects persisted and connected counts into workspace", async () => {
    const store = createTestStore();
    await store.createBot({ name: "Ops", role: "Operations", computerProfile: "docker-linux" });
    const app = createApp({
      listNodes: () => [
        {
          id: "node-1",
          name: "Linux worker",
          platform: "linux",
          capabilities: ["browser"],
          connectedAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      store,
    });
    const response = await app.request("/api/v1/workspace");

    expect(await response.json()).toMatchObject({
      counts: { bots: 1, channels: 0, connectedNodes: 1 },
    });
  });

  it("creates a Bot through the validated API", async () => {
    const app = createApp({ listNodes: () => [], store: createTestStore() });
    const response = await app.request("/api/v1/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const app = createApp({ listNodes: () => [], store: createTestStore() });
    const response = await app.request("/api/v1/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const app = createApp({ listNodes: () => [], store });
    const response = await app.request("/api/v1/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const channel = await store.createChannel({
      name: "运营中心",
      description: "日常任务",
      botIds: [],
    });
    const app = createApp({ listNodes: () => [], store });

    const created = await app.request(`/api/v1/channels/${channel.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "  打开测试页并截图  " }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      message: { channelId: channel.id, authorType: "human", content: "打开测试页并截图" },
    });

    const listed = await app.request(`/api/v1/channels/${channel.id}/messages`);
    expect(await listed.json()).toMatchObject({
      messages: [{ content: "打开测试页并截图" }],
    });
  });

  it("returns 404 when reading messages from an unknown channel", async () => {
    const app = createApp({ listNodes: () => [], store: createTestStore() });
    const response = await app.request(
      "/api/v1/channels/00000000-0000-4000-8000-000000000099/messages",
    );
    expect(response.status).toBe(404);
  });

  it("opens a channel event stream and publishes persisted messages", async () => {
    const store = createTestStore();
    const channel = await store.createChannel({
      name: "实时频道",
      description: "多设备同步",
      botIds: [],
    });
    const realtime = new ChannelRealtimeHub();
    const published: Message[] = [];
    const unsubscribe = realtime.subscribe(channel.id, (event) => {
      if (event.type === "message.created") published.push(event.message);
    });
    const app = createApp({ listNodes: () => [], realtime, store });
    const controller = new AbortController();
    const response = await app.request(`/api/v1/channels/${channel.id}/events`, {
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "同步给其他设备" }),
    });
    expect(created.status).toBe(201);
    expect(published).toMatchObject([{ channelId: channel.id, content: "同步给其他设备" }]);
    const messageChunk = await reader?.read();
    const messageEvent = new TextDecoder().decode(messageChunk?.value);
    expect(messageEvent).toContain("event: message.created");
    expect(messageEvent).toContain("同步给其他设备");

    await reader?.cancel();
    controller.abort();
    unsubscribe();
  });

  it("rejects an event stream for an unknown channel", async () => {
    const app = createApp({ listNodes: () => [], store: createTestStore() });
    const response = await app.request(
      "/api/v1/channels/00000000-0000-4000-8000-000000000099/events",
    );
    expect(response.status).toBe(404);
  });
});

function createTestStore(): ControlPlaneStore {
  const bots: Bot[] = [];
  const channels: Channel[] = [];
  const messages: Message[] = [];
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
    async getCounts() {
      return { bots: bots.length, channels: channels.length, activeRuns: 0 };
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
    async createMessage(channelId: string, input: CreateMessageInput) {
      if (!channels.some((channel) => channel.id === channelId)) {
        throw new StoreNotFoundError("Channel not found.");
      }
      const message: Message = {
        id: id(),
        channelId,
        authorType: "human",
        content: input.content,
        createdAt: new Date().toISOString(),
      };
      messages.push(message);
      return message;
    },
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
