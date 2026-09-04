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

export interface OpenBotDesktopBridge {
  getConnectionState(): Promise<DesktopConnectionState>;
  configureServer(serverUrl: string): Promise<ConfigureDesktopServerResult>;
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
    typeof bridge.configureServer !== "function"
  ) {
    return undefined;
  }
  return bridge;
}
