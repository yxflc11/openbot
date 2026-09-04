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

export type DesktopSetupMode = "client" | "client-worker" | "host" | "advanced";

export interface DesktopSetupPlanInput {
  localWorker: boolean;
  mode: DesktopSetupMode;
  plannedWorkerCount: number;
}

export type DesktopSetupPlanState =
  | Readonly<{ status: "unconfigured" }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "configured"; plan: Readonly<DesktopSetupPlanInput> }>;

export type SaveDesktopSetupPlanResult =
  | Extract<DesktopSetupPlanState, { status: "configured" }>
  | Readonly<{ status: "failed"; code: "invalid_plan" | "storage_unavailable" }>;

export interface OpenBotDesktopBridge {
  getConnectionState(): Promise<DesktopConnectionState>;
  configureServer(serverUrl: string): Promise<ConfigureDesktopServerResult>;
  getSetupPlanState(): Promise<DesktopSetupPlanState>;
  saveSetupPlan(plan: DesktopSetupPlanInput): Promise<SaveDesktopSetupPlanResult>;
}

declare global {
  interface Window {
    openbotDesktop?: OpenBotDesktopBridge;
  }
}

export function getOpenBotDesktopBridge(): OpenBotDesktopBridge | undefined {
  if (typeof window === "undefined") return undefined;
  const bridge = window.openbotDesktop;
  if (
    bridge === undefined ||
    typeof bridge.getConnectionState !== "function" ||
    typeof bridge.configureServer !== "function" ||
    typeof bridge.getSetupPlanState !== "function" ||
    typeof bridge.saveSetupPlan !== "function"
  ) {
    return undefined;
  }
  return bridge;
}
