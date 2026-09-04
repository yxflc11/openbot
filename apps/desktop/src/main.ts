import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  session,
  type Session,
  type WebContents,
} from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { FileDesktopConnectionStore } from "./connection-config.js";
import { DesktopConnectionController } from "./connection-controller.js";
import { desktopWindowIconPath } from "./desktop-icon.js";
import {
  isDesktopSessionAuthenticated,
  issueDesktopNodeEnrollmentToken,
} from "./desktop-server-actions.js";
import { isTrustedDesktopIpcSender } from "./ipc-security.js";
import { DesktopLocalWorkerController } from "./local-worker-controller.js";
import {
  DESKTOP_ENTRY_URL,
  DESKTOP_SCHEME,
  isDesktopAssetRequestMethod,
  resolveDesktopAssetPath,
} from "./local-content.js";
import { MacOSWorkerCompanion } from "./macos-worker-companion.js";
import {
  DESKTOP_CONFIGURE_SERVER_CHANNEL,
  DESKTOP_CONNECTION_STATE_CHANNEL,
  DESKTOP_ENABLE_LOCAL_WORKER_CHANNEL,
  DESKTOP_LOCAL_WORKER_STATE_CHANNEL,
  DESKTOP_OPEN_LOCAL_WORKER_SETTINGS_CHANNEL,
  DESKTOP_SAVE_SETUP_PLAN_CHANNEL,
  DESKTOP_SETUP_LOCAL_WORKER_CHANNEL,
  DESKTOP_SETUP_PLAN_STATE_CHANNEL,
} from "./runtime-contract.js";
import { proxyDesktopServerRequest } from "./server-proxy.js";
import { FileDesktopSetupPlanStore } from "./setup-plan.js";
import { DesktopSetupPlanController } from "./setup-plan-controller.js";
import {
  createDesktopWebPreferences,
  DESKTOP_PERMISSION_DECISION,
  DESKTOP_WINDOW_OPEN_DECISION,
} from "./security-policy.js";

let mainWindow: BrowserWindow | undefined;
let desktopSession: Session | undefined;

// Every renderer is sandboxed globally before Electron creates a process.
app.enableSandbox();
protocol.registerSchemesAsPrivileged([
  {
    scheme: DESKTOP_SCHEME,
    privileges: {
      codeCache: true,
      secure: true,
      standard: true,
      supportFetchAPI: true,
    },
  },
]);

function lockDownSession(desktopSession: Session): void {
  desktopSession.setPermissionCheckHandler(() => DESKTOP_PERMISSION_DECISION);
  desktopSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(DESKTOP_PERMISSION_DECISION);
  });
  desktopSession.on("will-download", (event) => event.preventDefault());
}

function lockDownWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(() => DESKTOP_WINDOW_OPEN_DECISION);
  contents.on("will-attach-webview", (event) => event.preventDefault());
  contents.on("will-navigate", (event) => event.preventDefault());
  contents.on("will-redirect", (event) => event.preventDefault());
}

function registerDesktopIpc(
  connectionController: DesktopConnectionController,
  setupPlanController: DesktopSetupPlanController,
  localWorkerController: DesktopLocalWorkerController,
): void {
  ipcMain.removeHandler(DESKTOP_CONNECTION_STATE_CHANNEL);
  ipcMain.removeHandler(DESKTOP_CONFIGURE_SERVER_CHANNEL);
  ipcMain.removeHandler(DESKTOP_SETUP_PLAN_STATE_CHANNEL);
  ipcMain.removeHandler(DESKTOP_SAVE_SETUP_PLAN_CHANNEL);
  ipcMain.removeHandler(DESKTOP_LOCAL_WORKER_STATE_CHANNEL);
  ipcMain.removeHandler(DESKTOP_SETUP_LOCAL_WORKER_CHANNEL);
  ipcMain.removeHandler(DESKTOP_ENABLE_LOCAL_WORKER_CHANNEL);
  ipcMain.removeHandler(DESKTOP_OPEN_LOCAL_WORKER_SETTINGS_CHANNEL);
  ipcMain.handle(DESKTOP_CONNECTION_STATE_CHANNEL, (event) => {
    if (!isTrustedDesktopIpcSender(event, mainWindow?.webContents)) {
      throw new Error("Desktop IPC sender is not allowed.");
    }
    return connectionController.getState();
  });
  ipcMain.handle(DESKTOP_CONFIGURE_SERVER_CHANNEL, (event, serverUrl: unknown) => {
    if (!isTrustedDesktopIpcSender(event, mainWindow?.webContents)) {
      throw new Error("Desktop IPC sender is not allowed.");
    }
    return connectionController.configure(serverUrl);
  });
  ipcMain.handle(DESKTOP_SETUP_PLAN_STATE_CHANNEL, (event) => {
    if (!isTrustedDesktopIpcSender(event, mainWindow?.webContents)) {
      throw new Error("Desktop IPC sender is not allowed.");
    }
    return setupPlanController.getState();
  });
  ipcMain.handle(DESKTOP_SAVE_SETUP_PLAN_CHANNEL, (event, plan: unknown) => {
    if (!isTrustedDesktopIpcSender(event, mainWindow?.webContents)) {
      throw new Error("Desktop IPC sender is not allowed.");
    }
    return setupPlanController.save(plan);
  });
  ipcMain.handle(DESKTOP_LOCAL_WORKER_STATE_CHANNEL, (event) => {
    if (!isTrustedDesktopIpcSender(event, mainWindow?.webContents)) {
      throw new Error("Desktop IPC sender is not allowed.");
    }
    return localWorkerController.getState();
  });
  ipcMain.handle(DESKTOP_SETUP_LOCAL_WORKER_CHANNEL, (event, nodeId: unknown) => {
    if (!isTrustedDesktopIpcSender(event, mainWindow?.webContents)) {
      throw new Error("Desktop IPC sender is not allowed.");
    }
    return localWorkerController.setup(nodeId);
  });
  ipcMain.handle(DESKTOP_ENABLE_LOCAL_WORKER_CHANNEL, (event) => {
    if (!isTrustedDesktopIpcSender(event, mainWindow?.webContents)) {
      throw new Error("Desktop IPC sender is not allowed.");
    }
    return localWorkerController.enable();
  });
  ipcMain.handle(DESKTOP_OPEN_LOCAL_WORKER_SETTINGS_CHANNEL, (event) => {
    if (!isTrustedDesktopIpcSender(event, mainWindow?.webContents)) {
      throw new Error("Desktop IPC sender is not allowed.");
    }
    return localWorkerController.openSettings();
  });
}

async function createMainWindow(activeSession: Session): Promise<void> {
  const preloadPath = join(app.getAppPath(), "dist", "preload.cjs");
  const window = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#f7f7f5",
    height: 840,
    icon: desktopWindowIconPath({
      appPath: app.getAppPath(),
      packaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
    }),
    minHeight: 640,
    minWidth: 960,
    show: false,
    title: "OpenBot",
    webPreferences: {
      ...createDesktopWebPreferences(preloadPath, !app.isPackaged),
      session: activeSession,
    },
    width: 1280,
  });

  mainWindow = window;
  window.once("ready-to-show", () => window.show());
  window.once("closed", () => {
    if (mainWindow === window) mainWindow = undefined;
  });
  await window.loadURL(DESKTOP_ENTRY_URL);
}

async function startDesktop(): Promise<void> {
  const activeSession = session.fromPartition("persist:openbot-desktop", { cache: true });
  const rendererRoot = join(app.getAppPath(), "dist", "renderer");
  const connectionController = new DesktopConnectionController({
    clearSessionData: () =>
      activeSession.clearData({
        dataTypes: [
          "cache",
          "cookies",
          "fileSystems",
          "indexedDB",
          "localStorage",
          "serviceWorkers",
        ],
      }),
    confirmServer: async (serverUrl) => {
      const window = mainWindow;
      if (window === undefined || window.isDestroyed()) {
        throw new Error("Desktop confirmation window is unavailable.");
      }
      const result = await dialog.showMessageBox(window, {
        buttons: ["连接", "取消"],
        cancelId: 1,
        defaultId: 1,
        detail: `OpenBot Desktop 将只连接这个 Server：\n${serverUrl}\n\n切换 Server 会清除当前 Desktop 会话。`,
        message: "确认 OpenBot Server",
        noLink: true,
        title: "OpenBot",
        type: "question",
      });
      return result.response === 0;
    },
    fetch: (input, init) => activeSession.fetch(input, init),
    store: new FileDesktopConnectionStore(join(app.getPath("userData"), "openbot", "server.json")),
  });
  const setupPlanController = new DesktopSetupPlanController(
    new FileDesktopSetupPlanStore(join(app.getPath("userData"), "openbot", "setup-plan.json")),
  );
  const localWorkerController = new DesktopLocalWorkerController({
    companion: new MacOSWorkerCompanion(process.resourcesPath),
    getConnectionState: () => connectionController.getState(),
    getSetupPlanState: () => setupPlanController.getState(),
    isAuthenticated: () =>
      isDesktopSessionAuthenticated(connectionController.getState(), (input, init) =>
        activeSession.fetch(input, init),
      ),
    issueEnrollmentToken: (nodeId, connection) =>
      issueDesktopNodeEnrollmentToken(nodeId, connection, (input, init) =>
        activeSession.fetch(input, init),
      ),
    platform: process.platform,
  });
  await Promise.all([connectionController.initialize(), setupPlanController.initialize()]);
  lockDownSession(activeSession);
  await activeSession.protocol.handle(DESKTOP_SCHEME, async (request) => {
    const serverResponse = await proxyDesktopServerRequest(
      request,
      connectionController.getState(),
      (input, init) => activeSession.fetch(input, init),
    );
    if (serverResponse !== undefined) return serverResponse;

    if (!isDesktopAssetRequestMethod(request.method)) {
      return new Response("Method not allowed", { status: 405 });
    }

    const assetPath = resolveDesktopAssetPath(rendererRoot, request.url);
    if (!assetPath) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(assetPath).toString());
  });
  desktopSession = activeSession;
  registerDesktopIpc(connectionController, setupPlanController, localWorkerController);
  await createMainWindow(activeSession);
}

app.on("web-contents-created", (_event, contents) => lockDownWebContents(contents));

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (!desktopSession) {
      console.error("OpenBot Desktop session is unavailable during activation.");
      app.exit(1);
      return;
    }
    void createMainWindow(desktopSession).catch((cause: unknown) => {
      console.error("OpenBot Desktop could not create its local window.", cause);
      app.exit(1);
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

void app
  .whenReady()
  .then(startDesktop)
  .catch((cause: unknown) => {
    console.error("OpenBot Desktop failed closed during startup.", cause);
    app.exit(1);
  });
