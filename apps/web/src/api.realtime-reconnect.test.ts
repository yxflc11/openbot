// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToChannelEvents, subscribeToWorkspaceEvents } from "./api";

type Handler = (event: Event) => void;

/**
 * Test double only. Native EventSource.close() (WHATWG / Chromium / Desktop
 * renderer) does not fire onerror. fireErrorOnClose models a hypothetical
 * sync close→onerror re-entry used to prove single-flight ordering — not a
 * proven production bug. Fail-before (api.ts @ b78c74f + fireErrorOnClose):
 * instances.length === 3. With fireErrorOnClose=false, old code passes.
 */
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
      if (url.includes("/workspace/events")) {
        this.emit("workspace.ready", { type: "workspace.ready", nodes: [], occurredAt: "t" });
      } else {
        this.emit("channel.ready", { type: "channel.ready", channelId: "channel", occurredAt: "t" });
      }
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
    // Defensive single-flight: one initial + exactly one reconnect.
    // Fail-before (old scheduleReconnect + fireErrorOnClose): length === 3.
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
    expect(onMessage).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe("subscribeToWorkspaceEvents reconnect", () => {
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
    const onRun = vi.fn();
    const onReady = vi.fn();
    const onState = vi.fn();
    const stop = subscribeToWorkspaceEvents({
      onApproval: vi.fn(),
      onEmployeeProfileChanged: vi.fn(),
      onNode: vi.fn(),
      onNodeRemoved: vi.fn(),
      onReady,
      onRun,
      onState,
    });
    await vi.runAllTicks();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]!.url).toContain("/workspace/events");
    MockEventSource.instances[0]!.error();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.runAllTicks();
    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances.filter((item) => item.readyState !== 2)).toHaveLength(1);
    const payload = {
      type: "run.updated",
      run: {
        id: "r1",
        channelId: "channel",
        botId: "bot",
        status: "running",
        createdAt: "2026-09-13T00:00:00Z",
        updatedAt: "2026-09-13T00:00:00Z",
      },
      artifacts: [],
    };
    for (const source of MockEventSource.instances) {
      if (source.readyState !== 2) source.emit("run.updated", payload);
    }
    expect(onRun).toHaveBeenCalledTimes(1);
    stop();
  });
});
