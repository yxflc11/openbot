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

  it("only loads host-supplied HTML once and rejects forged or oversized view messages", () => {
    const forwarded: unknown[] = [];
    const attributes: Record<string, string> = {};
    const host = { postMessage: (message: unknown) => forwarded.push(message) };
    const view = {
      contentWindow: {},
      setAttribute: (key: string, value: string) => {
        attributes[key] = value;
      },
      srcdoc: "",
      title: "",
    };
    let listener: (event: { source: unknown; data: unknown }) => void = () => {};
    let appended = 0;
    const script = pluginProxyDocument().match(/<script>([\s\S]*)<\/script>/u)?.[1];
    if (!script) throw new Error("Missing trusted proxy script");
    new Script(script).runInNewContext({
      window: {
        parent: host,
        addEventListener: (_name: string, callback: typeof listener) => {
          listener = callback;
        },
      },
      document: { createElement: () => view, body: { append: () => appended++ } },
      setInterval: () => 1,
      setTimeout: () => 2,
      clearInterval: () => {},
    });
    const resource = {
      jsonrpc: "2.0",
      method: "ui/notifications/sandbox-resource-ready",
      params: { html: "<h1>Untrusted view</h1>" },
    };
    listener({ source: {}, data: resource });
    expect(appended).toBe(0);
    listener({ source: host, data: resource });
    listener({ source: host, data: resource });
    expect(appended).toBe(1);
    expect(attributes.sandbox).toBe("allow-scripts");
    expect(view.srcdoc).toContain(PLUGIN_VIEW_CSP);
    const initialize = { jsonrpc: "2.0", id: 1, method: "ui/initialize", params: {} };
    listener({ source: {}, data: initialize });
    listener({ source: view.contentWindow, data: resource });
    listener({
      source: view.contentWindow,
      data: { ...initialize, params: { text: "x".repeat(16385) } },
    });
    expect(forwarded).toEqual([]);
    listener({ source: view.contentWindow, data: initialize });
    expect(forwarded).toEqual([initialize]);
  });
});
