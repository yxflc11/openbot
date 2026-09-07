import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import type { OpenBotDesktopBridge } from "./runtime-contract.js";

function preload() {
  const ipcRenderer = Object.assign(new EventEmitter(), {
    invoke: vi.fn(async () => ({ status: "enabled" })),
  });
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
          exposeInMainWorld: (key: string, value: OpenBotDesktopBridge) => {
            expect(key).toBe("openbotDesktop");
            bridge = value;
          },
        },
      };
    },
  });
  if (!bridge?.saveReport) {
    throw new Error("Sidebar bridge unavailable");
  }
  return { bridge, ipcRenderer };
}

describe("sandboxed report save preload", () => {
  it("exposes a fixed report command and rejects paths, URLs and objects before IPC", async () => {
    const { bridge, ipcRenderer } = preload();
    const id = "6d472024-ae0c-43a8-8ff7-b583c8eccb26";
    await bridge.saveReport?.(id);
    expect(ipcRenderer.invoke).toHaveBeenCalledExactlyOnceWith("openbot:save-report", id);
    for (const value of ["../report.md", "https://other.example", { id }, null, undefined]) {
      expect(await bridge.saveReport?.(value as string)).toEqual({ status: "unavailable" });
    }
    expect(ipcRenderer.invoke).toHaveBeenCalledTimes(1);
  });
});
