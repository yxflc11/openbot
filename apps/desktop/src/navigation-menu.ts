import type { MenuItemConstructorOptions } from "electron";
import { DESKTOP_ENTRY_URL } from "./local-content.js";
import {
  DESKTOP_NAVIGATION_COMMAND_CHANNEL,
  type DesktopNavigationCommand,
  type DesktopNavigationMenuState,
} from "./runtime-contract.js";

interface NavigationWindow {
  isDestroyed(): boolean;
  isFocused(): boolean;
  webContents: {
    mainFrame: { url: string };
    isDestroyed(): boolean;
    isLoadingMainFrame(): boolean;
    send(channel: string, command: DesktopNavigationCommand): void;
  };
}

interface NavigationMenu {
  getMenuItemById(id: string): { enabled: boolean } | null;
}

interface NavigationMenuOptions {
  appName: string;
  platform: string;
  getWindow(): NavigationWindow | undefined;
  install(template: MenuItemConstructorOptions[]): NavigationMenu;
}

const EMPTY_STATE: DesktopNavigationMenuState = Object.freeze({
  workspaceReady: false,
  settingsAvailable: false,
  canGoBack: false,
  canGoForward: false,
});

const COMMANDS: readonly DesktopNavigationCommand[] = [
  "new-conversation",
  "open-settings",
  "go-back",
  "go-forward",
  "toggle-sidebar",
  "toggle-details",
];

export function isDesktopNavigationMenuState(value: unknown): value is DesktopNavigationMenuState {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const keys = Object.keys(state);
  return (
    keys.length === 4 &&
    keys.every((key) => Object.hasOwn(EMPTY_STATE, key) && typeof state[key] === "boolean")
  );
}

export class DesktopNavigationMenuController {
  private state = EMPTY_STATE;
  private readonly menu: NavigationMenu;

  constructor(private readonly options: NavigationMenuOptions) {
    this.menu = options.install(
      createDesktopMenuTemplate(options.appName, options.platform, (command) =>
        this.dispatch(command),
      ),
    );
    this.refresh();
  }

  update(value: unknown): void {
    if (!isDesktopNavigationMenuState(value)) {
      throw new TypeError("Desktop navigation menu state is invalid.");
    }
    this.state = Object.freeze({ ...value });
    this.refresh();
  }

  reset(): void {
    this.state = EMPTY_STATE;
    this.refresh();
  }

  refresh(): void {
    const available = this.activeWindow() !== undefined;
    for (const command of COMMANDS) {
      const item = this.menu.getMenuItemById(command);
      if (item) item.enabled = available && this.commandAvailable(command);
    }
  }

  private commandAvailable(command: DesktopNavigationCommand): boolean {
    if (command === "open-settings") return this.state.settingsAvailable;
    if (command === "go-back") return this.state.canGoBack;
    if (command === "go-forward") return this.state.canGoForward;
    return this.state.workspaceReady;
  }

  private activeWindow(): NavigationWindow | undefined {
    const window = this.options.getWindow();
    if (!window || window.isDestroyed() || !window.isFocused()) return undefined;
    const contents = window.webContents;
    if (
      contents.isDestroyed() ||
      contents.isLoadingMainFrame() ||
      contents.mainFrame.url !== DESKTOP_ENTRY_URL
    ) {
      return undefined;
    }
    return window;
  }

  private dispatch(command: DesktopNavigationCommand): void {
    // A menu can remain open across a renderer lifecycle change; check again at selection time.
    const window = this.activeWindow();
    if (window && this.commandAvailable(command)) {
      window.webContents.send(DESKTOP_NAVIGATION_COMMAND_CHANNEL, command);
    }
  }
}

export function createDesktopMenuTemplate(
  appName: string,
  platform: string,
  dispatch: (command: DesktopNavigationCommand) => void,
): MenuItemConstructorOptions[] {
  const mac = platform === "darwin";
  const command = (
    id: DesktopNavigationCommand,
    label: string,
    accelerator: string,
  ): MenuItemConstructorOptions => ({
    id,
    label,
    accelerator,
    enabled: false,
    click: () => dispatch(id),
  });
  const settings = command("open-settings", "设置…", "CommandOrControl+,");
  const template: MenuItemConstructorOptions[] = [];
  if (mac) {
    template.push({
      label: appName,
      role: "appMenu",
      submenu: [
        { role: "about", label: `关于 ${appName}` },
        { type: "separator" },
        settings,
        { type: "separator" },
        { role: "services", label: "服务" },
        { type: "separator" },
        { role: "hide", label: `隐藏 ${appName}` },
        { role: "hideOthers", label: "隐藏其他" },
        { role: "unhide", label: "显示全部" },
        { type: "separator" },
        { role: "quit", label: `退出 ${appName}` },
      ],
    });
  }
  template.push(
    {
      label: "文件",
      submenu: [
        command("new-conversation", "新建对话", "CommandOrControl+N"),
        { type: "separator" },
        ...(mac ? [] : [settings, { type: "separator" as const }]),
        { role: "close", label: "关闭窗口" },
        ...(mac ? [] : [{ role: "quit" as const, label: `退出 ${appName}` }]),
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "拷贝" },
        { role: "paste", label: "粘贴" },
        { role: "pasteAndMatchStyle", label: "粘贴并匹配样式" },
        { role: "delete", label: "删除" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "显示",
      submenu: [
        command("toggle-sidebar", "显示/隐藏侧栏", "CommandOrControl+B"),
        command("toggle-details", "显示/隐藏信息栏", "CommandOrControl+Shift+B"),
        { type: "separator" },
        command("go-back", "后退", "CommandOrControl+["),
        command("go-forward", "前进", "CommandOrControl+]"),
        { type: "separator" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "进入/退出全屏" },
      ],
    },
    {
      label: "窗口",
      role: "windowMenu",
      submenu: [
        { role: "minimize", label: "最小化" },
        ...(mac
          ? [
              { role: "zoom" as const, label: "缩放" },
              { type: "separator" as const },
              { role: "front" as const, label: "前置全部窗口" },
            ]
          : [{ role: "close" as const, label: "关闭窗口" }]),
      ],
    },
  );
  return template;
}
