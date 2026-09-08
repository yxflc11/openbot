import { randomUUID } from "node:crypto";
import { type BrowserAction, type BrowserCommand, protocolVersion } from "@openbot/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDockerProvider } from "./index.js";

const botId = randomUUID();
const sessionId = randomUUID();
const bytes = Buffer.alloc(24);
bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
bytes.writeUInt32BE(1280, 16);
bytes.writeUInt32BE(800, 20);
const frame = {
  base64: bytes.toString("base64"),
  width: 1280,
  height: 800,
  capturedAt: new Date().toISOString(),
  url: "about:blank",
};
function command(action: BrowserAction): BrowserCommand {
  return {
    type: "browser.command",
    protocolVersion,
    nodeId: "worker",
    requestId: randomUUID(),
    botId,
    sessionId,
    expiresAt: new Date(Date.now() + 25_000).toISOString(),
    controlExpiresAt: new Date(Date.now() + 30_000).toISOString(),
    action,
  };
}
function fixture() {
  const calls: Array<{ path: string; body: unknown }> = [];
  const fetcher = vi.fn<typeof fetch>(async (url, init) => {
    const path = new URL(String(url)).pathname;
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return Response.json(
      path === "/screenshot" ? frame : { url: "https://example.test", title: "Example" },
    );
  });
  const provider = createDockerProvider({
    computerUrl: "http://127.0.0.1:4100",
    computerToken: "test-browser-token",
    fetcher,
    resolveHost: async () => ["203.0.113.10"],
  });
  const browser = provider.browser;
  const execute = provider.execute;
  if (!browser || !execute) throw new Error("Browser fixture requires an executable Provider.");
  return { provider: { ...provider, browser, execute }, calls, fetcher };
}
afterEach(() => vi.useRealTimers());
describe("employee browser adapter", () => {
  it("refuses input without exclusive control and forwards Unicode through human endpoints", async () => {
    const { provider, calls } = fixture();
    const signal = new AbortController().signal;
    await expect(
      provider.browser(command({ kind: "type", text: "secret" }), signal),
    ).rejects.toThrow(/control/);
    expect(calls).toHaveLength(0);
    await provider.browser(command({ kind: "take" }), signal);
    await provider.browser(command({ kind: "type", text: "你好. 🌏" }), signal);
    expect(calls).toContainEqual({ path: "/human/type", body: { text: "你好. 🌏" } });
    await expect(
      provider.browser(
        { ...command({ kind: "click", x: 1, y: 1 }), sessionId: randomUUID() },
        signal,
      ),
    ).rejects.toThrow(/control/);
    await provider.browser(command({ kind: "release" }), signal);
    await expect(
      provider.browser(command({ kind: "type", text: "after-release" }), signal),
    ).rejects.toThrow(/control/);
  });
  it("keeps Agent work paused after human lease expiry until explicit return", async () => {
    vi.useFakeTimers();
    const { provider } = fixture();
    const signal = new AbortController().signal;
    await provider.browser(command({ kind: "take" }), signal);
    vi.advanceTimersByTime(31_000);
    await expect(provider.browser(command({ kind: "type", text: "late" }), signal)).rejects.toThrow(
      /control/,
    );
    const run = () =>
      provider.execute(
        { nodeId: "worker", workDirectory: "/tmp", signal },
        {
          runId: randomUUID(),
          channelId: randomUUID(),
          botId,
          title: "test",
          instruction: "https://example.test",
          executionProfile: "docker-linux",
        },
        () => {},
      );
    await expect(run()).rejects.toThrow(/paused/);
    await provider.browser(command({ kind: "take" }), signal);
    await provider.browser(command({ kind: "release" }), signal);
    expect((await run()).ok).toBe(true);
  });
  it("validates navigation before releasing upstream control and re-takes after failed navigation", async () => {
    const { provider, fetcher, calls } = fixture();
    const signal = new AbortController().signal;
    await provider.browser(command({ kind: "take" }), signal);
    calls.length = 0;
    await expect(
      provider.browser(command({ kind: "navigate", url: "http://127.0.0.1/admin" }), signal),
    ).rejects.toThrow(/Private/);
    await expect(
      provider.browser(command({ kind: "navigate", url: "file:///etc/passwd" }), signal),
    ).rejects.toThrow(/HTTP/);
    expect(calls).toHaveLength(0);
    fetcher
      .mockResolvedValueOnce(Response.json({}))
      .mockRejectedValueOnce(new Error("navigation lost"));
    await expect(
      provider.browser(command({ kind: "navigate", url: "https://example.test" }), signal),
    ).rejects.toThrow();
    expect(calls.at(-1)?.path).toBe("/control/take");
  });
  it("refuses invalid PNGs and bounds the backend body before JSON parsing", async () => {
    const { provider, fetcher } = fixture();
    const signal = new AbortController().signal;
    fetcher.mockResolvedValueOnce(Response.json({ ...frame, width: 2 }));
    await expect(provider.browser(command({ kind: "observe" }), signal)).rejects.toThrow(
      /Invalid browser frame/,
    );
    fetcher.mockResolvedValueOnce(new Response("x".repeat(7_100_001)));
    await expect(provider.browser(command({ kind: "observe" }), signal)).rejects.toThrow(
      /size limit/,
    );
  });
});
