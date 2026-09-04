// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { OpenBotDesktopBridge } from "./desktop-runtime";
import { interact, renderComponent, setInputValue } from "./test/render-component";

afterEach(() => {
  delete window.openbotDesktop;
  vi.unstubAllGlobals();
});

describe("Desktop application connection gate", () => {
  it("does not call the Server until first-run setup has completed", async () => {
    const fetcher = vi.fn(async () => Response.json({ authenticated: false }));
    vi.stubGlobal("fetch", fetcher);
    const bridge: OpenBotDesktopBridge = {
      getConnectionState: vi.fn(async () => ({ status: "unconfigured" })),
      configureServer: vi.fn(async () => ({
        status: "configured",
        serverUrl: "https://openbot.example",
      })),
    };
    window.openbotDesktop = bridge;
    const rendered = await renderComponent(<App />);

    try {
      await settleEffects();
      expect(rendered.container.textContent).toContain("连接你的 Server");
      expect(fetcher).not.toHaveBeenCalled();

      const input = rendered.container.querySelector("#desktop-server-url");
      const form = rendered.container.querySelector("form");
      if (!(input instanceof HTMLInputElement) || form === null) {
        throw new Error("Desktop connection form not found.");
      }
      await setInputValue(input, "https://openbot.example");
      await interact(() =>
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
      );
      await settleEffects();

      expect(bridge.configureServer).toHaveBeenCalledWith("https://openbot.example");
      expect(fetcher).toHaveBeenCalledWith(
        "/api/v1/auth/session",
        expect.objectContaining({ credentials: "include" }),
      );
      expect(rendered.container.textContent).toContain("进入 OpenBot");
    } finally {
      await rendered.unmount();
    }
  });

  it("offers the configured Server again after a connection failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    window.openbotDesktop = {
      getConnectionState: vi.fn(async () => ({
        status: "configured",
        serverUrl: "https://openbot.example",
      })),
      configureServer: vi.fn(),
    };
    const rendered = await renderComponent(<App />);

    try {
      await settleEffects();
      expect(rendered.container.textContent).toContain("无法打开 OpenBot");
      const changeButton = [...rendered.container.querySelectorAll("button")].find(
        (button) => button.textContent === "更换 Server",
      );
      if (changeButton === undefined) throw new Error("Change Server button not found.");
      await interact(() => changeButton.click());
      expect(rendered.container.textContent).toContain("连接你的 Server");
      const input = rendered.container.querySelector("#desktop-server-url");
      expect(input).toBeInstanceOf(HTMLInputElement);
      expect((input as HTMLInputElement).value).toBe("https://openbot.example");
      expect(rendered.container.textContent).toContain("返回");
    } finally {
      await rendered.unmount();
    }
  });
});

async function settleEffects(): Promise<void> {
  await interact(() => undefined);
  await interact(() => undefined);
}
