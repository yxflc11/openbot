import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { isBoundedPluginMessage, PLUGIN_VIEW_CSP, pluginProxyDocument } from "./plugin-app-sandbox";

describe("plugin view containment", () => {
  it("accepts bounded JSON-RPC data and rejects cyclic, oversized and deeply nested inputs", () => {
    expect(
      isBoundedPluginMessage({ jsonrpc: "2.0", id: 1, method: "ui/initialize", params: {} }),
    ).toBe(true);
    expect(isBoundedPluginMessage({ text: "x".repeat(16385) })).toBe(false);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(isBoundedPluginMessage(cycle)).toBe(false);
    let nested: unknown = {};
    for (let i = 0; i < 14; i++) nested = { child: nested };
    expect(isBoundedPluginMessage(nested)).toBe(false);
  });
  it("builds a trusted proxy without interpolating plugin HTML into executable proxy code", () => {
    const proxy = pluginProxyDocument();
    const script = proxy.match(/<script>([\s\S]*)<\/script>/u)?.[1];
    if (!script) throw new Error("Missing trusted proxy script");
    expect(() => new Script(script)).not.toThrow();
    expect(proxy).toContain("event.source === host");
    expect(proxy).toContain("event.source === view.contentWindow");
    expect(proxy).toContain("view.setAttribute('sandbox','allow-scripts')");
    expect(PLUGIN_VIEW_CSP).toContain("connect-src 'none'");
    expect(PLUGIN_VIEW_CSP).toContain("frame-src 'none'");
    expect(PLUGIN_VIEW_CSP).not.toContain("https:");
    expect(proxy).not.toContain("allow-top-navigation");
    expect(proxy).not.toContain("allow-popups");
  });
});
