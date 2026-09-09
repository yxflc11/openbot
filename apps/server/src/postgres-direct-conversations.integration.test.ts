import { createDatabase } from "@openbot/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresControlPlaneStore } from "./postgres-store.js";

const databaseUrl = process.env.OPENBOT_DIRECT_TEST_DATABASE_URL;
// Never truncate a user's database: only an explicit disposable loopback fixture is eligible.
if (databaseUrl) {
  const target = new URL(databaseUrl);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !/^\/openbot_direct_test_[a-z0-9_]+$/.test(target.pathname)
  ) {
    throw new Error(
      "Direct conversation tests require a disposable loopback openbot_direct_test_* database.",
    );
  }
}

describe.skipIf(!databaseUrl)("PostgreSQL direct conversations", () => {
  const database = databaseUrl ? createDatabase(databaseUrl) : undefined;
  const peer = databaseUrl ? createDatabase(databaseUrl) : undefined;
  beforeAll(async () => {
    await database?.migrate();
    if (database) await database.client`truncate bots, channels cascade`;
  });
  afterAll(async () => {
    await Promise.all([database?.close(), peer?.close()]);
  });

  it("serializes repeated opens, preserves identity and rejects membership/routing changes", async () => {
    if (!database || !peer) return;
    const store = new PostgresControlPlaneStore(database.db);
    const peerStore = new PostgresControlPlaneStore(peer.db);
    const bot = await store.createBot({ name: "Ops", role: "Assistant", computerProfile: "none" });
    const other = await store.createBot({
      name: "Coder",
      role: "Assistant",
      computerProfile: "none",
    });
    const normal = await store.createChannel({
      name: bot.name,
      description: "normal channel",
      botIds: [other.id],
    });
    const opened = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        (index % 2 ? store : peerStore).getOrCreateDirectConversation(bot.id),
      ),
    );
    const direct = opened[0];
    if (direct === undefined) throw new Error("Expected a persisted conversation.");
    expect(new Set(opened.map((item) => item.id)).size).toBe(1);
    expect(direct).toMatchObject({ directBotId: bot.id, botIds: [bot.id], name: "Ops" });
    expect(direct.id).not.toBe(normal.id);
    expect(await peerStore.listChannels()).toContainEqual(direct);
    const audits =
      await database.client`select type from run_events where channel_id = ${direct.id}`;
    expect(audits.map((row) => row.type).sort()).toEqual(["BOT_JOINED_CHANNEL", "CHANNEL_CREATED"]);
    for (const id of [bot.id, other.id]) {
      await expect(store.joinBotToChannel(direct.id, id)).rejects.toThrow(
        "membership cannot be changed",
      );
    }
    await expect(store.getOrCreateDirectConversation("missing")).rejects.toThrow("Bot not found");
    await expect(
      store.submitTask(direct.id, { content: "Redirect", botId: other.id }),
    ).rejects.toThrow("only address its Bot");
    const result = await store.submitTask(direct.id, { content: "Prepare report" });
    expect(result.run.botId).toBe(bot.id);
    expect(await peerStore.listMessages(direct.id)).toContainEqual(result.message);
    // Renaming cannot detach or replace a direct conversation because the FK owns identity.
    await database.client`update bots set name = 'Renamed' where id = ${bot.id}`;
    expect((await peerStore.getOrCreateDirectConversation(bot.id)).id).toBe(direct.id);
    await expect(
      store.createChannel({ name: normal.name, description: "duplicate", botIds: [] }),
    ).rejects.toThrow("already exists");
    const otherDirect = await store.getOrCreateDirectConversation(other.id);
    expect(otherDirect.id).not.toBe(direct.id);
    expect(otherDirect.botIds).toEqual([other.id]);
  });
});
