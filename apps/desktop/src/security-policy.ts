import type { WebPreferences } from "electron";
import { isAbsolute, normalize } from "node:path";

export const DESKTOP_WINDOW_OPEN_DECISION = Object.freeze({ action: "deny" as const });
export const DESKTOP_PERMISSION_DECISION = false;

export function createDesktopWebPreferences(
  preloadPath: string,
  allowDevelopmentTools: boolean,
): Readonly<WebPreferences> {
  if (!isAbsolute(preloadPath) || !preloadPath.endsWith(".cjs")) {
    throw new Error("Desktop preload must be an absolute CommonJS file path.");
  }

  return Object.freeze({
    allowRunningInsecureContent: false,
    contextIsolation: true,
    devTools: allowDevelopmentTools,
    navigateOnDragDrop: false,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    nodeIntegrationInWorker: false,
    preload: normalize(preloadPath),
    safeDialogs: true,
    sandbox: true,
    webSecurity: true,
    webviewTag: false,
  });
}
