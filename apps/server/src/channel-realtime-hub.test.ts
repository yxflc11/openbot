import type { ChannelRealtimeEvent } from "@openbot/domain";
import { describe, expect, it } from "vitest";
import { ChannelRealtimeHub } from "./channel-realtime-hub.js";

describe("ChannelRealtimeHub", () => {
  it("isolates channels and removes subscriptions", () => {
    const hub = new ChannelRealtimeHub();
    const received: ChannelRealtimeEvent[] = [];
    const unsubscribe = hub.subscribe("channel-1", (event) => received.push(event));

    hub.publish({ type: "channel.ready", channelId: "channel-2", occurredAt: "2026-01-01" });
    hub.publish({ type: "channel.ready", channelId: "channel-1", occurredAt: "2026-01-02" });
    unsubscribe();
    hub.publish({ type: "channel.ready", channelId: "channel-1", occurredAt: "2026-01-03" });

    expect(received).toEqual([
      { type: "channel.ready", channelId: "channel-1", occurredAt: "2026-01-02" },
    ]);
  });
});
