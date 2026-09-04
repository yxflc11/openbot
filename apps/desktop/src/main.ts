import {
  app,
  BrowserWindow,
  net,
  protocol,
  session,
  type Session,
  type WebContents,
} from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DESKTOP_ENTRY_URL,
  DESKTOP_SCHEME,
  isDesktopAssetRequestMethod,
  resolveDesktopAssetPath,
} from "./local-content.js";
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

async function createMainWindow(activeSession: Session): Promise<void> {
  const preloadPath = join(app.getAppPath(), "dist", "preload.cjs");
  const window = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#f7f7f5",
    height: 840,
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
  lockDownSession(activeSession);
  await activeSession.protocol.handle(DESKTOP_SCHEME, (request) => {
    if (!isDesktopAssetRequestMethod(request.method)) {
      return new Response("Method not allowed", { status: 405 });
    }

    const assetPath = resolveDesktopAssetPath(rendererRoot, request.url);
    if (!assetPath) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(assetPath).toString());
  });
  desktopSession = activeSession;
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
