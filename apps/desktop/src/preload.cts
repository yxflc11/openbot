import type { OpenBotDesktopBridge } from "./runtime-contract.js";

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");
const DESKTOP_CONNECTION_STATE_CHANNEL: typeof import("./runtime-contract.js").DESKTOP_CONNECTION_STATE_CHANNEL =
  "openbot:desktop-connection-state";
const DESKTOP_CONFIGURE_SERVER_CHANNEL: typeof import("./runtime-contract.js").DESKTOP_CONFIGURE_SERVER_CHANNEL =
  "openbot:desktop-configure-server";
const DESKTOP_SETUP_PLAN_STATE_CHANNEL: typeof import("./runtime-contract.js").DESKTOP_SETUP_PLAN_STATE_CHANNEL =
  "openbot:desktop-setup-plan-state";
const DESKTOP_SAVE_SETUP_PLAN_CHANNEL: typeof import("./runtime-contract.js").DESKTOP_SAVE_SETUP_PLAN_CHANNEL =
  "openbot:desktop-save-setup-plan";
const DESKTOP_LOCAL_WORKER_STATE_CHANNEL: typeof import("./runtime-contract.js").DESKTOP_LOCAL_WORKER_STATE_CHANNEL =
  "openbot:desktop-local-worker-state";
const DESKTOP_SETUP_LOCAL_WORKER_CHANNEL: typeof import("./runtime-contract.js").DESKTOP_SETUP_LOCAL_WORKER_CHANNEL =
  "openbot:desktop-setup-local-worker";
const DESKTOP_ENABLE_LOCAL_WORKER_CHANNEL: typeof import("./runtime-contract.js").DESKTOP_ENABLE_LOCAL_WORKER_CHANNEL =
  "openbot:desktop-enable-local-worker";
const DESKTOP_OPEN_LOCAL_WORKER_SETTINGS_CHANNEL: typeof import("./runtime-contract.js").DESKTOP_OPEN_LOCAL_WORKER_SETTINGS_CHANNEL =
  "openbot:desktop-open-local-worker-settings";

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
  getSetupPlanState: () => ipcRenderer.invoke(DESKTOP_SETUP_PLAN_STATE_CHANNEL),
  saveSetupPlan: (plan: Parameters<OpenBotDesktopBridge["saveSetupPlan"]>[0]) => {
    if (!isBoundedSetupPlanInput(plan)) {
      return Promise.resolve({ status: "failed", code: "invalid_plan" });
    }
    return ipcRenderer.invoke(DESKTOP_SAVE_SETUP_PLAN_CHANNEL, plan);
  },
  getLocalWorkerState: () => ipcRenderer.invoke(DESKTOP_LOCAL_WORKER_STATE_CHANNEL),
  setupLocalWorker: (nodeId: string) => {
    if (!isBoundedNodeId(nodeId)) {
      return Promise.resolve({ status: "failed", code: "invalid_node_id" });
    }
    return ipcRenderer.invoke(DESKTOP_SETUP_LOCAL_WORKER_CHANNEL, nodeId);
  },
  enableLocalWorker: () => ipcRenderer.invoke(DESKTOP_ENABLE_LOCAL_WORKER_CHANNEL),
  openLocalWorkerSettings: () => ipcRenderer.invoke(DESKTOP_OPEN_LOCAL_WORKER_SETTINGS_CHANNEL),
});

contextBridge.exposeInMainWorld("openbotDesktop", bridge);

function isBoundedSetupPlanInput(
  input: unknown,
): input is Parameters<OpenBotDesktopBridge["saveSetupPlan"]>[0] {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  return (
    keys.length === 3 &&
    keys[0] === "localWorker" &&
    keys[1] === "mode" &&
    keys[2] === "plannedWorkerCount" &&
    typeof value.localWorker === "boolean" &&
    ["client", "client-worker", "host", "advanced"].includes(String(value.mode)) &&
    Number.isInteger(value.plannedWorkerCount) &&
    Number(value.plannedWorkerCount) >= 0 &&
    Number(value.plannedWorkerCount) <= 100
  );
}

function isBoundedNodeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  );
}
