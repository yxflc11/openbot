import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESKTOP_ICON_RESOURCE_NAME, desktopWindowIconPath } from "./desktop-icon.js";

describe("Desktop window icon", () => {
  it("uses the source resource while developing", () => {
    expect(
      desktopWindowIconPath({
        appPath: join("workspace", "apps", "desktop"),
        packaged: false,
        resourcesPath: join("electron", "resources"),
      }),
    ).toBe(join("workspace", "apps", "desktop", "resources", DESKTOP_ICON_RESOURCE_NAME));
  });

  it("uses the copied package resource after packaging", () => {
    expect(
      desktopWindowIconPath({
        appPath: join("package", "app.asar"),
        packaged: true,
        resourcesPath: join("package", "resources"),
      }),
    ).toBe(join("package", "resources", DESKTOP_ICON_RESOURCE_NAME));
  });
});
