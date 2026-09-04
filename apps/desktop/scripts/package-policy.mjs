import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { isAbsolute, join, relative, sep } from "node:path";

const ALLOWED_PACKAGE_ROOTS = new Set(["dist"]);
const ALLOWED_PACKAGE_FILES = new Set(["package.json"]);

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
  return !ALLOWED_PACKAGE_ROOTS.has(candidate.split("/")[0]);
}

export function packagedElectronTarget(bundlePath, platform) {
  if (platform === "darwin") return join(bundlePath, "OpenBot.app");
  if (platform === "win32") return join(bundlePath, "openbot.exe");
  if (platform === "linux") return join(bundlePath, "openbot");
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
