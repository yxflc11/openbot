import type { OpenBotDesktopBridge } from "./runtime-contract.js";

const { contextBridge } = require("electron") as typeof import("electron");

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
});

contextBridge.exposeInMainWorld("openbotDesktop", bridge);
