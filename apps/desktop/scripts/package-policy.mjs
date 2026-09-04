import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { basename, isAbsolute, join, relative, sep } from "node:path";

const ALLOWED_PACKAGE_ROOTS = new Set(["dist"]);
const ALLOWED_PACKAGE_FILES = new Set(["package.json"]);
const ALLOWED_RUNTIME_DEPENDENCY_ROOTS = [
  "node_modules/signal-exit",
  "node_modules/write-file-atomic",
];

export const DESKTOP_RUNTIME_DEPENDENCIES = Object.freeze({
  "signal-exit": "4.1.0",
  "write-file-atomic": "8.0.0",
});

export const REQUIRED_DESKTOP_ASAR_ENTRIES = Object.freeze([
  "/dist/main.js",
  "/dist/preload.cjs",
  "/dist/renderer/index.html",
  "/node_modules/signal-exit/dist/cjs/index.js",
  "/node_modules/signal-exit/package.json",
  "/node_modules/write-file-atomic/lib/index.js",
  "/node_modules/write-file-atomic/package.json",
  "/package.json",
]);

export const DESKTOP_WINDOWS_METADATA = Object.freeze({
  CompanyName: "OpenBot contributors",
});

export const DESKTOP_ICON_RESOURCE_NAME = "openbot-icon.png";
export const DESKTOP_MACOS_WORKER_COMPANION_NAME = "OpenBot Worker Host.app";

export function packagedDesktopResource(bundlePath, platform, resourceName) {
  if (platform === "darwin") {
    return join(bundlePath, "OpenBot.app", "Contents", "Resources", resourceName);
  }
  if (platform === "win32" || platform === "linux") {
    return join(bundlePath, "resources", resourceName);
  }
  throw new Error(`Unsupported Desktop package platform: ${platform}`);
}

export function desktopMacOSWorkerCompanionSource(input, platform) {
  if (input === undefined || input === "") return undefined;
  if (
    platform !== "darwin" ||
    typeof input !== "string" ||
    input.length > 4_096 ||
    !isAbsolute(input) ||
    basename(input) !== DESKTOP_MACOS_WORKER_COMPANION_NAME ||
    /[\0\r\n]/u.test(input)
  ) {
    throw new Error("Desktop macOS Worker companion source is invalid.");
  }
  return input;
}

export function packagedDesktopMacOSWorkerCompanion(bundlePath, platform) {
  if (platform !== "darwin") return undefined;
  return packagedDesktopResource(bundlePath, platform, DESKTOP_MACOS_WORKER_COMPANION_NAME);
}

export function shouldIgnoreDesktopSource(appRoot, candidatePath) {
  const platformCandidate =
    candidatePath === appRoot
      ? ""
      : isAbsolute(candidatePath) && candidatePath.startsWith(`${appRoot}${sep}`)
        ? relative(appRoot, candidatePath)
        : candidatePath.replace(/^[/\\]+/u, "");
  const candidate = platformCandidate.replaceAll("\\", "/");
  if (candidate === "") return false;
  if (candidate.split("/").includes("..")) return true;
  if (ALLOWED_PACKAGE_FILES.has(candidate)) return false;
  if (
    ALLOWED_RUNTIME_DEPENDENCY_ROOTS.some(
      (root) => candidate === root || candidate.startsWith(`${root}/`),
    )
  ) {
    return false;
  }
  return !ALLOWED_PACKAGE_ROOTS.has(candidate.split("/")[0]);
}

export function validateDesktopAsarEntries(entries) {
  const retained = new Set(
    entries.map((entry) => {
      const normalized = entry.replaceAll("\\", "/");
      return normalized.startsWith("/") ? normalized : `/${normalized}`;
    }),
  );
  for (const required of REQUIRED_DESKTOP_ASAR_ENTRIES) {
    if (!retained.has(required)) {
      throw new Error(`Packaged Desktop ASAR is missing ${required}.`);
    }
  }
  for (const entry of retained) {
    if (!entry.startsWith("/node_modules/")) continue;
    const allowed = ALLOWED_RUNTIME_DEPENDENCY_ROOTS.some(
      (root) => entry === `/${root}` || entry.startsWith(`/${root}/`),
    );
    if (!allowed) throw new Error(`Packaged Desktop ASAR contains unexpected dependency ${entry}.`);
  }
}

export function packagedElectronTarget(bundlePath, platform) {
  if (platform === "darwin") return join(bundlePath, "OpenBot.app");
  if (platform === "win32") return join(bundlePath, "openbot.exe");
  if (platform === "linux") return join(bundlePath, "openbot");
  throw new Error(`Unsupported Desktop package platform: ${platform}`);
}

export function packagedAsarPath(bundlePath, platform) {
  if (platform === "darwin")
    return join(bundlePath, "OpenBot.app", "Contents", "Resources", "app.asar");
  if (platform === "win32" || platform === "linux")
    return join(bundlePath, "resources", "app.asar");
  throw new Error(`Unsupported Desktop package platform: ${platform}`);
}

export function createDesktopFuseConfig(platform, arch) {
  return {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: platform === "darwin" && arch === "arm64",
    strictlyRequireAllFuses: true,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    // This package does not ship the custom browser_v8_context_snapshot.bin required by the fuse.
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    [FuseV1Options.WasmTrapHandlers]: false,
  };
}
