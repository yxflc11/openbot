import type { OpenBotDesktopBridge } from "./runtime-contract.js";

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");
const DESKTOP_CONNECTION_STATE_CHANNEL: typeof import("./runtime-contract.js").DESKTOP_CONNECTION_STATE_CHANNEL =
  "openbot:desktop-connection-state";
const DESKTOP_CONFIGURE_SERVER_CHANNEL: typeof import("./runtime-contract.js").DESKTOP_CONFIGURE_SERVER_CHANNEL =
  "openbot:desktop-configure-server";

const shellVersion = process.versions.electron;
if (shellVersion === undefined || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(shellVersion)) {
  throw new Error("Electron version is invalid.");
}

const runtimeInfo = Object.freeze({
  kind: "desktop" as const,
  platform: process.platform,
  shellVersion,
});
const bridge: OpenBotDesktopBridge = Object.freeze({
  getRuntimeInfo: () => runtimeInfo,
  getConnectionState: () => ipcRenderer.invoke(DESKTOP_CONNECTION_STATE_CHANNEL),
  configureServer: (serverUrl: string) => {
    if (typeof serverUrl !== "string" || serverUrl.length === 0 || serverUrl.length > 2_048) {
      return Promise.resolve({ status: "failed", code: "invalid_url" });
    }
    return ipcRenderer.invoke(DESKTOP_CONFIGURE_SERVER_CHANNEL, serverUrl);
  },
});

contextBridge.exposeInMainWorld("openbotDesktop", bridge);
