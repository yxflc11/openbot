// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToChannelEvents } from "./api";

type Handler = (event: Event) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  static fireErrorOnClose = false;
  readonly url: string;
  readyState = 0;
  onerror: Handler | null = null;
  onopen: Handler | null = null;
  readonly listeners = new Map<string, Set<Handler>>();
  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    queueMicrotask(() => {
      if (this.readyState === 2) return;
      this.readyState = 1;
      this.onopen?.(new Event("open"));
      this.emit("channel.ready", { type: "channel.ready", channelId: "channel", occurredAt: "t" });
    });
  }
  addEventListener(type: string, handler: Handler) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler);
    this.listeners.set(type, set);
  }
  close() {
    if (this.readyState === 2) return;
    this.readyState = 2;
    if (MockEventSource.fireErrorOnClose) this.onerror?.(new Event("error"));
  }
  emit(type: string, payload: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(payload) });
    for (const handler of this.listeners.get(type) ?? []) handler(event);
  }
  error() {
    this.readyState = 0;
    this.onerror?.(new Event("error"));
  }
}

describe("subscribeToChannelEvents reconnect", () => {
  afterEach(() => {
    vi.useRealTimers();
    MockEventSource.instances = [];
    MockEventSource.fireErrorOnClose = false;
    vi.unstubAllGlobals();
  });

  it("opens only one replacement EventSource after an error even when close re-enters onerror", async () => {
    vi.useFakeTimers();
    MockEventSource.fireErrorOnClose = true;
    vi.stubGlobal("EventSource", MockEventSource);
    const onMessage = vi.fn();
    const onReady = vi.fn();
    const onState = vi.fn();
    const stop = subscribeToChannelEvents("channel", {
      onMessage,
      onFrame: vi.fn(),
      onProgress: vi.fn(),
      onRun: vi.fn(),
      onReady,
      onState,
    });
    await vi.runAllTicks();
    expect(MockEventSource.instances).toHaveLength(1);
    const first = MockEventSource.instances[0]!;
    first.error();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.runAllTicks();
    // One initial + exactly one reconnect. Two reconnects would double-deliver live events.
    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances.filter((item) => item.readyState !== 2)).toHaveLength(1);
    const message = {
      type: "message.created",
      channelId: "channel",
      message: {
        id: "m1",
        channelId: "channel",
        authorType: "human",
        content: "once",
        createdAt: "2026-09-13T00:00:00Z",
      },
    };
    for (const source of MockEventSource.instances) {
      if (source.readyState !== 2) source.emit("message.created", message);
    }
    // If a leaked EventSource stayed open it would also emit; assert single delivery.
    expect(onMessage).toHaveBeenCalledTimes(1);
    stop();
  });
});
