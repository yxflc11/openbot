import type { Bot, Channel, CreateBotInput, CreateChannelInput } from "@openbot/domain";
import { describe, expect, it } from "vitest";
import type { ControlPlaneStore } from "./control-plane-store.js";
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
});

function createTestStore(): ControlPlaneStore {
  const bots: Bot[] = [];
  const channels: Channel[] = [];
  let nextId = 0;
  const id = () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`;

  return {
    async listBots() {
      return bots;
    },
    async listChannels() {
      return channels;
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
