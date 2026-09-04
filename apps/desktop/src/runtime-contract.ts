import type { DesktopSetupPlanInput } from "./setup-plan.js";

export interface DesktopRuntimeInfo {
  kind: "desktop";
  platform: string;
  shellVersion: string;
}

export type DesktopConnectionState =
  | Readonly<{ status: "unconfigured" }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "configured"; serverUrl: string }>;

export type ConfigureDesktopServerResult =
  | Readonly<{ status: "configured"; serverUrl: string }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{
      status: "failed";
      code:
        | "invalid_url"
        | "server_unreachable"
        | "server_redirected"
        | "not_openbot_server"
        | "confirmation_unavailable"
        | "storage_unavailable";
    }>;

export type DesktopSetupPlanState =
  | Readonly<{ status: "unconfigured" }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "configured"; plan: Readonly<DesktopSetupPlanInput> }>;

export type SaveDesktopSetupPlanResult =
  | Extract<DesktopSetupPlanState, { status: "configured" }>
  | Readonly<{ status: "failed"; code: "invalid_plan" | "storage_unavailable" }>;

export const DESKTOP_CONNECTION_STATE_CHANNEL = "openbot:desktop-connection-state";
export const DESKTOP_CONFIGURE_SERVER_CHANNEL = "openbot:desktop-configure-server";
export const DESKTOP_SETUP_PLAN_STATE_CHANNEL = "openbot:desktop-setup-plan-state";
export const DESKTOP_SAVE_SETUP_PLAN_CHANNEL = "openbot:desktop-save-setup-plan";

export interface OpenBotDesktopBridge {
  getRuntimeInfo(): DesktopRuntimeInfo;
  getConnectionState(): Promise<DesktopConnectionState>;
  configureServer(serverUrl: string): Promise<ConfigureDesktopServerResult>;
  getSetupPlanState(): Promise<DesktopSetupPlanState>;
  saveSetupPlan(plan: DesktopSetupPlanInput): Promise<SaveDesktopSetupPlanResult>;
}

export function createDesktopRuntimeInfo(
  platform: string,
  shellVersion: string,
): DesktopRuntimeInfo {
  if (!/^[a-z0-9_-]{1,32}$/u.test(platform)) {
    throw new Error("Desktop platform identifier is invalid.");
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(shellVersion)) {
    throw new Error("Electron version is invalid.");
  }
  return Object.freeze({ kind: "desktop", platform, shellVersion });
}
