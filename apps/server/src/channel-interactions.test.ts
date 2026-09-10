import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createChannelInteractionRoutes } from "./channel-interactions-routes.js";
import { ChannelRealtimeHub } from "./channel-realtime-hub.js";
import { StoreConflictError, StoreNotFoundError } from "./control-plane-store.js";

function fixture() {
  const store = {
    listReactions: vi.fn(async () => []),
    setReaction: vi.fn(async () => []),
    removeMember: vi.fn(async () => ({
      channel: {
        id: "channel",
        name: "Channel",
        description: "",
        botIds: [],
        createdAt: new Date().toISOString(),
      },
      cancelledRuns: [],
    })),
  };
  const realtime = new ChannelRealtimeHub();
  const listener = vi.fn();
  realtime.subscribe("channel", listener);
  const onRemoved = vi.fn();
  return {
    store,
    listener,
    onRemoved,
    app: createChannelInteractionRoutes({ store, realtime, onRemoved }),
  };
}
describe("channel interaction routes", () => {
  it("does not apply its tiny reaction-body limit to other channel features", async () => {
    const f = fixture();
    const parent = new Hono();
    parent.route("/api/v1", f.app);
    parent.post("/api/v1/channels/channel/messages", async (context) =>
      context.text(await context.req.text()),
    );
    const body = "x".repeat(2048);
    const response = await parent.request("/api/v1/channels/channel/messages", {
      method: "POST",
      body,
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(body);
  });
  it("saves an idempotent Owner choice then publishes the committed reaction state", async () => {
    const f = fixture();
    const response = await f.app.request("/channels/channel/messages/message/reactions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emoji: "👍", active: true }),
    });
    expect(response.status).toBe(200);
    expect(f.store.setReaction).toHaveBeenCalledWith("channel", "message", {
      emoji: "👍",
      active: true,
    });
    expect(f.listener).toHaveBeenCalledWith({
      type: "message.reactions",
      channelId: "channel",
      messageId: "message",
      reactions: [],
    });
  });
  it.each([
    { emoji: "bad", active: true },
    { emoji: "👍", active: true, actor: "bot" },
    { emoji: "👍", active: "yes" },
  ])("rejects invalid reaction intent before mutation", async (body) => {
    const f = fixture();
    expect(
      (
        await f.app.request("/channels/channel/messages/message/reactions", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(400);
    expect(f.store.setReaction).not.toHaveBeenCalled();
  });
  it("notifies cancellation only after member removal commits and keeps errors content-free", async () => {
    const f = fixture();
    expect((await f.app.request("/channels/channel/bots/bot", { method: "DELETE" })).status).toBe(
      200,
    );
    expect(f.onRemoved).toHaveBeenCalledOnce();
    expect(f.listener).toHaveBeenCalledWith(expect.objectContaining({ type: "channel.updated" }));
    f.store.removeMember.mockRejectedValueOnce(new StoreConflictError("Direct conversation"));
    expect((await f.app.request("/channels/channel/bots/bot", { method: "DELETE" })).status).toBe(
      409,
    );
    expect(f.onRemoved).toHaveBeenCalledOnce();
    f.store.listReactions.mockRejectedValueOnce(new StoreNotFoundError("Missing"));
    expect((await f.app.request("/channels/channel/reactions")).status).toBe(404);
    f.store.listReactions.mockRejectedValueOnce(new Error("PRIVATE DB BODY"));
    const response = await f.app.request("/channels/channel/reactions");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("PRIVATE");
  });
});
