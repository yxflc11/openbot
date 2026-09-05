import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import type { DesktopNavigationMenuState, OpenBotDesktopBridge } from "./runtime-contract.js";

function preload() {
  const ipcRenderer = Object.assign(new EventEmitter(), { invoke: vi.fn(async () => undefined) });
  let bridge: OpenBotDesktopBridge | undefined;
  const source = readFileSync(new URL("./preload.cts", import.meta.url), "utf8");
  runInNewContext(stripTypeScriptTypes(source, { mode: "strip" }), {
    exports: {},
    process: { versions: { electron: "44.2.0" }, platform: "darwin" },
    require: (name: string) => {
      if (name !== "electron") throw new Error("Unexpected sandbox import");
      return {
        ipcRenderer,
        contextBridge: {
          exposeInMainWorld: (_key: string, value: OpenBotDesktopBridge) => {
            bridge = value;
          },
        },
      };
    },
  });
  if (!bridge?.onNavigationCommand || !bridge.updateNavigationMenuState) {
    throw new Error("Navigation bridge unavailable");
  }
  return { bridge, ipcRenderer };
}

describe("sandboxed navigation preload", () => {
  it("exposes only six fixed commands, strips the native event, and removes its own listener", () => {
    const { bridge, ipcRenderer } = preload();
    const commands = vi.fn();
    const otherListener = vi.fn();
    const unsubscribe = bridge.onNavigationCommand?.(commands);
    const unsubscribeOther = bridge.onNavigationCommand?.(otherListener);
    const event = { sender: ipcRenderer };
    for (const command of [
      "new-conversation",
      "open-settings",
      "go-back",
      "go-forward",
      "toggle-sidebar",
      "toggle-details",
    ]) {
      ipcRenderer.emit("openbot:navigation-command", event, command);
    }
    expect(commands.mock.calls).toEqual([
      ["new-conversation"],
      ["open-settings"],
      ["go-back"],
      ["go-forward"],
      ["toggle-sidebar"],
      ["toggle-details"],
    ]);
    for (const command of [
      null,
      {},
      [],
      { command: "go-back" },
      "reload",
      "toggleDevTools",
      "open-settings ",
    ]) {
      ipcRenderer.emit("openbot:navigation-command", event, command);
    }
    expect(commands).toHaveBeenCalledTimes(6);
    unsubscribe?.();
    expect(ipcRenderer.listenerCount("openbot:navigation-command")).toBe(1);
    ipcRenderer.emit("openbot:navigation-command", event, "go-back");
    expect(commands).toHaveBeenCalledTimes(6);
    expect(otherListener).toHaveBeenCalledTimes(7);
    unsubscribeOther?.();
    expect(ipcRenderer.listenerCount("openbot:navigation-command")).toBe(0);
  });

  it("accepts only an exact boolean snapshot over a fixed IPC channel", async () => {
    const { bridge, ipcRenderer } = preload();
    const state = {
      workspaceReady: true,
      settingsAvailable: true,
      canGoBack: false,
      canGoForward: false,
    };
    await bridge.updateNavigationMenuState?.(state);
    expect(ipcRenderer.invoke).toHaveBeenCalledExactlyOnceWith(
      "openbot:navigation-menu-state",
      state,
    );
    expect(ipcRenderer.invoke.mock.calls[0]?.[1]).not.toBe(state);
    for (const value of [
      null,
      {},
      [],
      "true",
      { ...state, extra: true },
      { ...state, canGoBack: 1 },
      { workspaceReady: true, settingsAvailable: true, canGoBack: false },
    ]) {
      await expect(
        bridge.updateNavigationMenuState?.(value as DesktopNavigationMenuState),
      ).rejects.toThrow(/invalid/u);
    }
    expect(ipcRenderer.invoke).toHaveBeenCalledTimes(1);
  });
});
