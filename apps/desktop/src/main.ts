import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  type Session,
  safeStorage,
  session,
  utilityProcess,
  type WebContents,
} from "electron";
import { FileDesktopConnectionStore } from "./connection-config.js";
import { DesktopConnectionController } from "./connection-controller.js";
import { desktopWindowIconPath } from "./desktop-icon.js";
import {
  isDesktopSessionAuthenticated,
  issueDesktopNodeEnrollmentToken,
} from "./desktop-server-actions.js";
import { isTrustedDesktopIpcSender } from "./ipc-security.js";
import {
  DESKTOP_ENTRY_URL,
  DESKTOP_SCHEME,
  isDesktopAssetRequestMethod,
  resolveDesktopAssetPath,
} from "./local-content.js";
import { DesktopLocalWorkerController } from "./local-worker-controller.js";
import { MacOSWorkerCompanion } from "./macos-worker-companion.js";
import { NativeServerController } from "./native-server.js";
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
import {
  createDesktopWebPreferences,
  DESKTOP_PERMISSION_DECISION,
  DESKTOP_WINDOW_OPEN_DECISION,
} from "./security-policy.js";
import { proxyDesktopServerRequest } from "./server-proxy.js";
import { FileDesktopSetupPlanStore } from "./setup-plan.js";
import { DesktopSetupPlanController } from "./setup-plan-controller.js";

let nativeServer: NativeServerController | undefined;
let quitting = false;
let mainWindow: BrowserWindow | undefined;
let desktopSession: Session | undefined;

// Every renderer is sandboxed globally before Electron creates a process.
app.enableSandbox();
// A profile owns one bootstrap transaction and one local database supervisor.
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
app.on("second-instance", () => {
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.show();
  mainWindow?.focus();
});
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
  ipcMain.handle(DESKTOP_SAVE_SETUP_PLAN_CHANNEL, async (event, plan: unknown) => {
    if (!isTrustedDesktopIpcSender(event, mainWindow?.webContents)) {
      throw new Error("Desktop IPC sender is not allowed.");
    }
    const result = await setupPlanController.save(plan);
    if (result.status === "configured" && result.plan.mode !== "host") await nativeServer?.stop();
    return result;
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
    // Preserve native macOS controls while letting the sidebar extend into window chrome.
    ...(process.platform === "darwin"
      ? { titleBarStyle: "hidden" as const, trafficLightPosition: { x: 20, y: 20 } }
      : {}),
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
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
      if (nativeServer?.owns(serverUrl)) return true;
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
  const nativeRuntimeRoot = app.isPackaged
    ? join(process.resourcesPath, "native-runtime")
    : join(app.getAppPath(), "native-runtime");
  nativeServer = new NativeServerController({
    runtimeRoot: nativeRuntimeRoot,
    dataRoot: join(app.getPath("userData"), "openbot", "local-server"),
    platform: process.platform,
    encrypt: (value) => {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("Keychain is unavailable.");
      return safeStorage.encryptString(value).toString("base64");
    },
    decrypt: (value) => {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("Keychain is unavailable.");
      return safeStorage.decryptString(Buffer.from(value, "base64"));
    },
    launchServer: async (env) => {
      const child = utilityProcess.fork(join(nativeRuntimeRoot, "apps/server/dist/index.js"), [], {
        env,
        cwd: nativeRuntimeRoot,
        stdio: "ignore",
        serviceName: "OpenBot Server",
      });
      let alive = true;
      child.once("exit", () => {
        alive = false;
      });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error("Server startup timed out."));
        }, 30_000);
        child.once("exit", () => {
          clearTimeout(timer);
          reject(new Error("Server exited before readiness."));
        });
        child.on("message", (message: unknown) => {
          if (
            typeof message === "object" &&
            message !== null &&
            "type" in message &&
            "port" in message &&
            message.type === "openbot-server-ready" &&
            message.port === Number(env.OPENBOT_PORT)
          ) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      return {
        isAlive: () => alive,
        stop: async () => {
          if (!alive) return;
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              if (alive && child.pid !== undefined) {
                try {
                  process.kill(child.pid, "SIGKILL");
                } catch {
                  /* Child already exited. */
                }
              }
              resolve();
            }, 12_000);
            child.once("exit", () => {
              clearTimeout(timer);
              resolve();
            });
            child.kill();
          });
        },
      };
    },
    connect: async (serverUrl, ownerPassword) => {
      const connected = await connectionController.configure(serverUrl);
      if (connected.status !== "configured") throw new Error("Local Server not ready.");
      const response = await activeSession.fetch(`${serverUrl}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        redirect: "error",
        headers: { "Content-Type": "application/json", Origin: serverUrl },
        body: JSON.stringify({ password: ownerPassword }),
        signal: AbortSignal.timeout(5000),
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error("Local session could not be created.");
    },
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
  ipcMain.handle("openbot:native-server-state", (event) => {
    if (!isTrustedDesktopIpcSender(event, mainWindow?.webContents))
      throw new Error("Untrusted sender.");
    return nativeServer?.getState();
  });
  ipcMain.handle("openbot:install-native-server", (event) => {
    if (!isTrustedDesktopIpcSender(event, mainWindow?.webContents))
      throw new Error("Untrusted sender.");
    const plan = setupPlanController.getState();
    if (plan.status !== "configured" || plan.plan.mode !== "host")
      throw new Error("Service role required.");
    return nativeServer?.start();
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

app.on("before-quit", (event) => {
  if (quitting || nativeServer === undefined) return;
  event.preventDefault();
  quitting = true;
  void nativeServer.stop().finally(() => app.quit());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

void app
  .whenReady()
  .then(() => (ownsInstance ? startDesktop() : undefined))
  .catch((cause: unknown) => {
    console.error("OpenBot Desktop failed closed during startup.", cause);
    app.exit(1);
  });
