import { randomUUID } from "node:crypto";
import type { Bot, ExecutionNode } from "@openbot/domain";
import { type BrowserCommand, protocolVersion } from "@openbot/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type BrowserGateway, BrowserSessions, type BrowserStore } from "./browser-sessions.js";

const bot: Bot = {
  id: randomUUID(),
  name: "Ops",
  role: "Browser",
  status: "idle",
  computerProfile: "docker-linux",
  createdAt: new Date().toISOString(),
};
const node: ExecutionNode = {
  id: "browser-node",
  name: "Browser worker",
  platform: "linux",
  architecture: "x64",
  osVersion: "6.8",
  deviceClass: "container",
  isolation: "container",
  trustTier: "development",
  capabilities: ["browser", "screenshot"],
  capabilityManifest: [
    { id: "browser.session", version: 1, providerId: "docker", constraints: {} },
  ],
  maxConcurrentRuns: 1,
  activeRunIds: [],
  connectedAt: new Date().toISOString(),
  lastSeenAt: new Date().toISOString(),
};
function fixture() {
  const events: unknown[] = [];
  const frame = {
    base64: "iVBORw0KGgo=",
    width: 1,
    height: 1,
    capturedAt: new Date().toISOString(),
    url: "about:blank",
  };
  const store: BrowserStore = {
    listBots: async () => [bot],
    listRuns: async () => [],
    upsertNode: async () => undefined,
    getBrowserNode: async () => undefined,
    recordBrowserEvent: vi.fn(async (event) => {
      events.push(event);
    }),
  };
  let disconnected = (_node: ExecutionNode) => {};
  const gateway: BrowserGateway = {
    list: () => [node],
    setBrowserPaused: vi.fn(),
    onUnavailable: (handler) => {
      disconnected = handler;
      return () => {};
    },
    browserCommand: vi.fn(async (command: BrowserCommand) => ({
      type: "browser.result",
      protocolVersion,
      nodeId: node.id,
      requestId: command.requestId,
      sessionId: command.sessionId,
      ok: true,
      frame,
    })),
  };
  const service = new BrowserSessions(store, gateway);
  return { service, store, gateway, events, disconnect: () => disconnected(node) };
}
afterEach(() => vi.useRealTimers());
describe("Server-owned browser sessions", () => {
  it("isolates viewers and audits intent before a single human input, without its contents", async () => {
    const { service, gateway, events } = fixture();
    const a = await service.open(bot.id, "owner-session");
    const b = await service.open(bot.id, "owner-session");
    await expect(service.command(a.id, "another-login", { kind: "observe" })).rejects.toThrow(
      /会话已结束/,
    );
    await expect(
      service.command(a.id, "owner-session", { kind: "type", text: "secret" }),
    ).rejects.toThrow(/接管/);
    expect((await service.command(a.id, "owner-session", { kind: "take" })).control).toBe("mine");
    await expect(service.command(b.id, "owner-session", { kind: "take" })).rejects.toThrow(
      /另一个窗口/,
    );
    expect((await service.command(b.id, "owner-session", { kind: "observe" })).control).toBe(
      "other",
    );
    await service.command(a.id, "owner-session", { kind: "type", text: "private-password-123" });
    expect(events.at(-2)).toMatchObject({ action: "type", phase: "intent" });
    expect(events.at(-1)).toMatchObject({ action: "type", phase: "completed" });
    expect(JSON.stringify(events)).not.toContain("private-password");
    await service.command(a.id, "owner-session", { kind: "release" });
    expect(gateway.setBrowserPaused).toHaveBeenLastCalledWith(bot.id, false);
    expect((await service.command(b.id, "owner-session", { kind: "take" })).control).toBe("mine");
  });
  it("expires control without resuming the employee and refuses stale/closed sessions", async () => {
    vi.useFakeTimers();
    const { service, gateway, disconnect } = fixture();
    const a = await service.open(bot.id, "owner");
    await service.command(a.id, "owner", { kind: "take" });
    vi.advanceTimersByTime(31_000);
    expect((await service.command(a.id, "owner", { kind: "observe" })).control).toBe("paused");
    await expect(service.command(a.id, "owner", { kind: "key", key: "Enter" })).rejects.toThrow(
      /接管/,
    );
    expect(gateway.setBrowserPaused).not.toHaveBeenCalledWith(bot.id, false);
    await service.command(a.id, "owner", { kind: "take" });
    service.close(a.id, "owner");
    await expect(service.command(a.id, "owner", { kind: "observe" })).rejects.toThrow(/会话已结束/);
    const b = await service.open(bot.id, "owner");
    disconnect();
    await expect(service.command(b.id, "owner", { kind: "observe" })).rejects.toThrow(/会话已结束/);
  });
  it("does not route to another computer when the bound one disappears", async () => {
    const { service, store } = fixture();
    store.getBrowserNode = async () => "old-browser-node";
    await expect(service.open(bot.id, "owner")).rejects.toThrow(/原来的浏览器主机/);
  });
  it("fails closed when audit storage fails and never retries an uncertain action", async () => {
    const { service, store, gateway } = fixture();
    const a = await service.open(bot.id, "owner");
    await service.command(a.id, "owner", { kind: "take" });
    vi.mocked(gateway.browserCommand).mockClear();
    vi.mocked(store.recordBrowserEvent).mockRejectedValueOnce(new Error("DB unavailable"));
    await expect(service.command(a.id, "owner", { kind: "type", text: "secret" })).rejects.toThrow(
      "DB unavailable",
    );
    expect(gateway.browserCommand).not.toHaveBeenCalled();
    vi.mocked(gateway.browserCommand).mockRejectedValueOnce(new Error("socket lost"));
    await expect(service.command(a.id, "owner", { kind: "click", x: 1, y: 1 })).rejects.toThrow(
      /不会自动重试/,
    );
    expect(gateway.browserCommand).toHaveBeenCalledTimes(1);
    vi.mocked(gateway.browserCommand).mockRejectedValueOnce(new Error("take uncertain"));
    await expect(service.command(a.id, "owner", { kind: "take" })).rejects.toThrow(/不会自动重试/);
    expect((await service.command(a.id, "owner", { kind: "observe" })).control).toBe("paused");
  });
});
