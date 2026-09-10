import { createDatabase } from "@openbot/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PostgresChannelInteractions } from "./channel-interactions-store.js";
import { PostgresAgentStore } from "./postgres-agent-store.js";
import { PostgresControlPlaneStore } from "./postgres-store.js";

const url = process.env.OPENBOT_INTERACTIONS_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    parsed.hostname !== "127.0.0.1" ||
    !/^\/openbot_interactions_test_[a-z0-9_]+$/.test(parsed.pathname)
  )
    throw new Error("Use a disposable loopback interactions database.");
}
describe.skipIf(!url)("PostgreSQL channel reactions and member removal", () => {
  const database = url ? createDatabase(url) : undefined;
  beforeAll(async () => {
    await database?.migrate();
  });
  beforeEach(async () => {
    if (database) {
      await database.client`set client_min_messages=warning`;
      await database.client`truncate bots,channels cascade`;
    }
  });
  afterAll(async () => {
    await database?.close();
  });
  async function fixture() {
    if (!database) throw new Error("Missing test database");
    const control = new PostgresControlPlaneStore(database.db),
      store = new PostgresChannelInteractions(database.db),
      native = new PostgresAgentStore(database.db);
    const bot = await control.createBot({
        name: "Coordinator",
        role: "Coordinator",
        computerProfile: "none",
      }),
      peer = await control.createBot({ name: "Peer", role: "Peer", computerProfile: "none" });
    const channel = await control.createChannel({
      name: "Channel",
      description: "",
      botIds: [bot.id, peer.id],
    });
    const submitted = await control.submitTask(channel.id, { content: "Discuss", botId: bot.id });
    return { control, store, native, bot, peer, channel, submitted };
  }
  it("deduplicates parallel Owner reactions and preserves them across store instances", async () => {
    const f = await fixture();
    await Promise.all(
      Array.from({ length: 8 }, () =>
        f.store.setReaction(f.channel.id, f.submitted.message.id, { emoji: "👍", active: true }),
      ),
    );
    expect(await f.store.listReactions(f.channel.id)).toEqual([
      { messageId: f.submitted.message.id, emoji: "👍", actor: "owner" },
    ]);
    await f.store.setReaction(f.channel.id, f.submitted.message.id, { emoji: "👍", active: false });
    expect(await f.store.listReactions(f.channel.id)).toEqual([]);
  });
  it("rejects wrong-channel messages and malformed emoji without persistence", async () => {
    const f = await fixture();
    const other = await f.control.createChannel({
      name: "Other",
      description: "",
      botIds: [f.bot.id],
    });
    await expect(
      f.store.setReaction(other.id, f.submitted.message.id, { emoji: "👍", active: true }),
    ).rejects.toThrow(/Message not found/);
    expect(await f.store.listReactions(other.id)).toEqual([]);
  });
  it("revokes target and descendants while retaining historical messages and allowing explicit rejoin", async () => {
    const f = await fixture();
    const root = await f.native.claim(f.submitted.run, new Date(Date.now() - 60000).toISOString());
    if (!root) throw new Error("Missing claim");
    const child = await f.native.delegate(root, { botId: f.peer.id, task: "Help" });
    const before = await f.control.listMessages(f.channel.id);
    const removed = await f.store.removeMember(f.channel.id, f.bot.id);
    expect(removed.channel.botIds).toEqual([f.peer.id]);
    expect(removed.cancelledRuns.map((run) => run.id).sort()).toEqual(
      [root.id, child.run.id].sort(),
    );
    await expect(f.native.complete(child.run, "Late")).rejects.toThrow();
    expect(await f.control.listMessages(f.channel.id)).toEqual(before);
    await f.control.joinBotToChannel(f.channel.id, f.bot.id);
    expect((await f.native.lookup(root.id))?.status).toBe("cancelled");
    expect((await f.store.removeMember(f.channel.id, f.bot.id)).cancelledRuns).toEqual([]);
  });
  it("rejects removing a direct-channel Bot and preserves its fixed identity", async () => {
    const f = await fixture();
    const direct = await f.control.getOrCreateDirectConversation(f.bot.id);
    await expect(f.store.removeMember(direct.id, f.bot.id)).rejects.toThrow(/Direct/);
    expect(
      (await f.control.listChannels()).find((channel) => channel.id === direct.id)?.botIds,
    ).toEqual([f.bot.id]);
  });
});
