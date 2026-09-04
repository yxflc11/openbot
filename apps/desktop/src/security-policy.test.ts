import { describe, expect, it } from "vitest";
import {
  createDesktopWebPreferences,
  DESKTOP_PERMISSION_DECISION,
  DESKTOP_WINDOW_OPEN_DECISION,
} from "./security-policy.js";

describe("Desktop renderer security policy", () => {
  it("keeps the renderer sandboxed and disables ambient Electron authority", () => {
    const preferences = createDesktopWebPreferences("/opt/openbot/dist/preload.cjs", false);

    expect(preferences).toMatchObject({
      allowRunningInsecureContent: false,
      contextIsolation: true,
      devTools: false,
      navigateOnDragDrop: false,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      nodeIntegrationInWorker: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    });
    expect(Object.isFrozen(preferences)).toBe(true);
  });

  it("rejects ambiguous preload locations", () => {
    expect(() => createDesktopWebPreferences("dist/preload.cjs", false)).toThrow(/absolute/u);
    expect(() => createDesktopWebPreferences("/opt/openbot/preload.js", false)).toThrow(
      /CommonJS/u,
    );
  });

  it("denies permissions and new windows by default", () => {
    expect(DESKTOP_PERMISSION_DECISION).toBe(false);
    expect(DESKTOP_WINDOW_OPEN_DECISION).toEqual({ action: "deny" });
  });
});
