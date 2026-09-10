// @vitest-environment jsdom
import type { Bot } from "@openbot/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Plugin, PluginManifest } from "../plugin-api";
import { interact, renderComponent, setInputValue } from "../test/render-component";
import { PluginGrantEditor, PluginInstallForm, PluginToolList } from "./PluginManagerPanel";

const manifest: PluginManifest = {
  name: "Example",
  endpoint: "https://example.com/mcp",
  digest: "a".repeat(64),
  tools: [
    {
      name: "write",
      description: "<img src=x onerror=alert(1)>",
      inputSchema: { type: "object" },
      annotations: { readOnlyHint: true },
    },
  ],
};
const plugin: Plugin = {
  ...manifest,
  id: "p",
  revision: "revision",
  enabled: false,
  grants: [],
  createdAt: "2026-09-10T00:00:00Z",
};
const bot: Bot = {
  id: "bot",
  name: "Researcher",
  role: "research",
  status: "idle",
  computerProfile: "none",
  createdAt: plugin.createdAt,
};
afterEach(() => vi.unstubAllGlobals());

describe("plugin Owner management", () => {
  it("requires reviewed declarations and invalidates review when the endpoint changes", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => manifest });
    vi.stubGlobal("fetch", fetcher);
    const view = await renderComponent(<PluginInstallForm onInstalled={vi.fn()} />);
    try {
      const inputs = view.container.querySelectorAll<HTMLInputElement>("input");
      if (!inputs[0] || !inputs[1]) throw new Error("Plugin inputs missing");
      await setInputValue(inputs[0], "Example");
      await setInputValue(inputs[1], manifest.endpoint);
      await interact(() =>
        view.container
          .querySelector("form")
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
      );
      const install = Array.from(view.container.querySelectorAll("button")).find(
        (button) => button.textContent === "安装为停用状态",
      );
      expect(install?.disabled).toBe(true);
      await interact(() =>
        view.container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click(),
      );
      expect(install?.disabled).toBe(false);
      await setInputValue(inputs[1], "https://other.example/mcp");
      expect(view.container.querySelector('input[type="checkbox"]')).toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      await view.unmount();
    }
  });

  it("submits the exact reviewed digest without granting or enabling tools", async () => {
    const installed = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => manifest })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plugin }) });
    vi.stubGlobal("fetch", fetcher);
    const view = await renderComponent(<PluginInstallForm onInstalled={installed} />);
    try {
      const inputs = view.container.querySelectorAll<HTMLInputElement>("input");
      if (!inputs[0] || !inputs[1]) throw new Error("Plugin inputs missing");
      await setInputValue(inputs[0], "Example");
      await setInputValue(inputs[1], manifest.endpoint);
      await interact(() =>
        view.container
          .querySelector("form")
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
      );
      await interact(() =>
        view.container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click(),
      );
      await interact(() =>
        Array.from(view.container.querySelectorAll("button"))
          .find((button) => button.textContent === "安装为停用状态")
          ?.click(),
      );
      expect(JSON.parse(fetcher.mock.calls[1]?.[1].body)).toEqual({
        name: "Example",
        endpoint: manifest.endpoint,
        reviewedDigest: manifest.digest,
      });
      expect(installed).toHaveBeenCalledTimes(1);
    } finally {
      await view.unmount();
    }
  });

  it("does not authorize from annotations and escapes plugin descriptions", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const view = await renderComponent(
      <>
        <PluginToolList tools={plugin.tools} />
        <PluginGrantEditor plugin={plugin} bots={[bot]} disabled={false} onSave={save} />
      </>,
    );
    try {
      expect(view.container.querySelector("img")).toBeNull();
      expect(view.container.textContent).toContain("<img src=x onerror=alert(1)>");
      const permission = view.container.querySelector<HTMLSelectElement>(
        '[aria-label="write 调用权限"]',
      );
      if (!permission) throw new Error("Permission select missing");
      expect(permission.value).toBe("none");
      await interact(() => {
        permission.value = "confirm";
        permission.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await interact(() =>
        view.container
          .querySelector("form")
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
      );
      expect(save).toHaveBeenCalledWith(bot.id, [{ name: "write", mode: "confirm" }], {
        resources: [],
        prompts: [],
      });
    } finally {
      await view.unmount();
    }
  });
});
