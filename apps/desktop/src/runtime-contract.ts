export interface DesktopRuntimeInfo {
  kind: "desktop";
  platform: string;
  shellVersion: string;
}

export interface OpenBotDesktopBridge {
  getRuntimeInfo(): DesktopRuntimeInfo;
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
