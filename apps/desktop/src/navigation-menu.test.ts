import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import { DESKTOP_ENTRY_URL } from "./local-content.js";
import {
  createDesktopMenuTemplate,
  DesktopNavigationMenuController,
  isDesktopNavigationMenuState,
} from "./navigation-menu.js";
import {
  DESKTOP_NAVIGATION_COMMAND_CHANNEL,
  type DesktopNavigationMenuState,
} from "./runtime-contract.js";

const ready: DesktopNavigationMenuState = {
  workspaceReady: true,
  settingsAvailable: true,
  canGoBack: true,
  canGoForward: false,
};

function flatten(template: MenuItemConstructorOptions[]): MenuItemConstructorOptions[] {
  return template.flatMap((item) => [
    item,
    ...(Array.isArray(item.submenu) ? flatten(item.submenu) : []),
  ]);
}

function harness() {
  const window = {
    isDestroyed: vi.fn(() => false),
    isFocused: vi.fn(() => true),
    webContents: {
      mainFrame: { url: DESKTOP_ENTRY_URL },
      isDestroyed: vi.fn(() => false),
      isLoadingMainFrame: vi.fn(() => false),
      send: vi.fn(),
    },
  };
  const getWindow = vi.fn((): typeof window | undefined => window);
  let items: MenuItemConstructorOptions[] = [];
  const install = vi.fn((template: MenuItemConstructorOptions[]) => {
    items = flatten(template);
    return {
      getMenuItemById: (id: string) => items.find((item) => item.id === id) ?? null,
    };
  });
  const controller = new DesktopNavigationMenuController({
    appName: "OpenBot Preview",
    platform: "darwin",
    getWindow,
    install,
  });
  function item(id: string) {
    const found = items.find((value) => value.id === id);
    if (!found) throw new Error(`Missing menu action: ${id}`);
    return found;
  }
  function click(id: string) {
    const handler = item(id).click as (() => void) | undefined;
    if (!handler) throw new Error(`Missing menu handler: ${id}`);
    handler();
  }
  return { controller, window, getWindow, install, item, click };
}

describe("native navigation menu", () => {
  it("provides Chinese menus while retaining native editing, zoom, and window roles", () => {
    const template = createDesktopMenuTemplate("OpenBot Preview", "darwin", vi.fn());
    expect(template.map((item) => item.label)).toEqual([
      "OpenBot Preview",
      "文件",
      "编辑",
      "显示",
      "窗口",
    ]);
    const items = flatten(template);
    expect(items.filter((item) => item.role).map((item) => item.role)).toEqual(
      expect.arrayContaining([
        "about",
        "services",
        "quit",
        "close",
        "undo",
        "redo",
        "cut",
        "copy",
        "paste",
        "selectAll",
        "resetZoom",
        "zoomIn",
        "zoomOut",
        "togglefullscreen",
        "minimize",
      ]),
    );
    expect(
      items.some((item) =>
        ["reload", "forceReload", "toggleDevTools", "viewMenu"].includes(item.role ?? ""),
      ),
    ).toBe(false);
    expect(items.filter((item) => item.role).every((item) => item.click === undefined)).toBe(true);
    expect(items.filter((item) => item.id).map(({ id, accelerator }) => [id, accelerator])).toEqual(
      [
        ["open-settings", "CommandOrControl+,"],
        ["new-conversation", "CommandOrControl+N"],
        ["toggle-sidebar", "CommandOrControl+B"],
        ["toggle-details", "CommandOrControl+Shift+B"],
        ["go-back", "CommandOrControl+["],
        ["go-forward", "CommandOrControl+]"],
      ],
    );
  });

  it.each(["linux", "win32"])(
    "places settings in File without macOS-only roles on %s",
    (platform) => {
      const template = createDesktopMenuTemplate("OpenBot", platform, vi.fn());
      const items = flatten(template);
      expect(template[0]?.label).toBe("文件");
      expect(items.filter((item) => item.id === "open-settings")).toHaveLength(1);
      expect(
        items.some((item) =>
          ["appMenu", "services", "hide", "hideOthers", "front"].includes(item.role ?? ""),
        ),
      ).toBe(false);
    },
  );

  it("starts disabled and updates only actions available in the renderer snapshot", () => {
    const { controller, item, click, window, install } = harness();
    expect(item("new-conversation").enabled).toBe(false);
    click("new-conversation");
    expect(window.webContents.send).not.toHaveBeenCalled();
    controller.update(ready);
    expect(item("new-conversation").enabled).toBe(true);
    expect(item("open-settings").enabled).toBe(true);
    expect(item("go-back").enabled).toBe(true);
    expect(item("go-forward").enabled).toBe(false);
    click("go-forward");
    click("new-conversation");
    expect(window.webContents.send).toHaveBeenCalledExactlyOnceWith(
      DESKTOP_NAVIGATION_COMMAND_CHANNEL,
      "new-conversation",
    );
    controller.update({ ...ready, workspaceReady: false, canGoForward: true });
    expect(item("toggle-sidebar").enabled).toBe(false);
    expect(item("toggle-details").enabled).toBe(false);
    expect(item("open-settings").enabled).toBe(true);
    expect(item("go-forward").enabled).toBe(true);
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("does not retain mutable renderer state and clears stale availability on reset", () => {
    const { controller, item, click, window } = harness();
    const snapshot = { ...ready };
    controller.update(snapshot);
    snapshot.workspaceReady = false;
    controller.refresh();
    expect(item("new-conversation").enabled).toBe(true);
    controller.reset();
    expect(item("new-conversation").enabled).toBe(false);
    expect(item("go-back").enabled).toBe(false);
    click("open-settings");
    expect(window.webContents.send).not.toHaveBeenCalled();
  });

  it("rechecks focus, renderer lifetime, loading, and exact local origin at selection time", () => {
    const { controller, window, click, getWindow } = harness();
    controller.update(ready);
    const rejectWhile = (change: () => void, restore: () => void) => {
      change();
      click("new-conversation");
      expect(window.webContents.send).not.toHaveBeenCalled();
      restore();
    };
    rejectWhile(
      () => getWindow.mockReturnValue(undefined),
      () => getWindow.mockReturnValue(window),
    );
    rejectWhile(
      () => window.isDestroyed.mockReturnValue(true),
      () => window.isDestroyed.mockReturnValue(false),
    );
    rejectWhile(
      () => window.isFocused.mockReturnValue(false),
      () => window.isFocused.mockReturnValue(true),
    );
    rejectWhile(
      () => window.webContents.isDestroyed.mockReturnValue(true),
      () => window.webContents.isDestroyed.mockReturnValue(false),
    );
    rejectWhile(
      () => window.webContents.isLoadingMainFrame.mockReturnValue(true),
      () => window.webContents.isLoadingMainFrame.mockReturnValue(false),
    );
    rejectWhile(
      () => {
        window.webContents.mainFrame.url = "https://example.com";
      },
      () => {
        window.webContents.mainFrame.url = DESKTOP_ENTRY_URL;
      },
    );
    click("new-conversation");
    expect(window.webContents.send).toHaveBeenCalledTimes(1);
  });

  it("disables custom entries when focus is lost and restores availability on focus", () => {
    const { controller, window, item } = harness();
    controller.update(ready);
    window.isFocused.mockReturnValue(false);
    controller.refresh();
    expect(item("open-settings").enabled).toBe(false);
    window.isFocused.mockReturnValue(true);
    controller.refresh();
    expect(item("open-settings").enabled).toBe(true);
  });

  it.each([
    null,
    undefined,
    [],
    "ready",
    {},
    { ...ready, extra: true },
    { ...ready, workspaceReady: 1 },
    { workspaceReady: true, settingsAvailable: true, canGoBack: true },
  ])("rejects a malformed snapshot without altering current availability: %j", (value) => {
    const { controller, item } = harness();
    controller.update(ready);
    expect(isDesktopNavigationMenuState(value)).toBe(false);
    expect(() => controller.update(value)).toThrow(/invalid/u);
    expect(item("new-conversation").enabled).toBe(true);
  });
});
