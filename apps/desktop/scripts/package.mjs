import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listPackage } from "@electron/asar";
import { FuseState, FuseV1Options, flipFuses, getCurrentFuseWire } from "@electron/fuses";
import { packager } from "@electron/packager";
import { validateMacOSWorkerHostApplication } from "../../../scripts/macos-worker-host-release.mjs";
import {
  createDesktopFuseConfig,
  DESKTOP_ICON_RESOURCE_NAME,
  DESKTOP_PREVIEW_IDENTITY,
  DESKTOP_RUNTIME_DEPENDENCIES,
  DESKTOP_WINDOWS_METADATA,
  desktopMacOSWorkerCompanionSource,
  desktopPackagedManifest,
  desktopPackageIdentity,
  packagedAsarPath,
  packagedDesktopMacOSWorkerCompanion,
  packagedDesktopResource,
  packagedElectronTarget,
  shouldIgnoreDesktopSource,
  validateDesktopAsarEntries,
} from "./package-policy.mjs";
import { copyContainedResource } from "./package-resources.mjs";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const identity = desktopPackageIdentity(process.argv.slice(2));
const workspaceRoot = join(appRoot, "..", "..");
const rendererEntry = join(appRoot, "dist", "renderer", "index.html");
const nativeRuntime = process.platform === "darwin" ? join(appRoot, "native-runtime") : undefined;
const desktopIconBase = join(appRoot, "resources", "openbot-icon");
const desktopIconPng = `${desktopIconBase}.png`;
const electronDistribution = join(
  dirname(fileURLToPath(import.meta.resolve("electron/package.json"))),
  "dist",
);
const packageManifest = JSON.parse(await readFile(join(appRoot, "package.json"), "utf8"));
const previewDownload =
  identity === DESKTOP_PREVIEW_IDENTITY
    ? {
        cacheRoot: join(appRoot, "out", "preview", ".electron-cache"),
        checksums: JSON.parse(
          await readFile(
            join(
              dirname(fileURLToPath(import.meta.resolve("electron/package.json"))),
              "checksums.json",
            ),
            "utf8",
          ),
        ),
      }
    : undefined;
const workerCompanionSource = desktopMacOSWorkerCompanionSource(
  process.env.OPENBOT_DESKTOP_MACOS_WORKER_COMPANION,
  process.platform,
  identity,
);

await Promise.all([
  ...(nativeRuntime
    ? [
        access(join(nativeRuntime, "apps/server/dist/index.js")),
        access(join(nativeRuntime, "postgres/bin/postgres")),
      ]
    : []),
  access(rendererEntry),
  access(desktopIconPng),
  access(`${desktopIconBase}.icns`),
  access(`${desktopIconBase}.ico`),
]);
if (workerCompanionSource !== undefined) {
  await validateMacOSWorkerHostApplication(workerCompanionSource, {
    expectedOwner: process.getuid?.(),
  });
}

const packagePaths = await packager({
  appBundleId: identity.appBundleId,
  appVersion: packageManifest.version,
  arch: process.arch,
  asar: true,
  dir: appRoot,
  ...(previewDownload ? { download: previewDownload } : {}),
  electronVersion: "44.2.0",
  extraResource: [
    desktopIconPng,
    join(electronDistribution, "LICENSE"),
    join(electronDistribution, "LICENSES.chromium.html"),
  ],
  afterCopyExtraResources: [
    async ({ buildPath }) => {
      if (nativeRuntime) {
        await copyContainedResource(
          nativeRuntime,
          packagedDesktopResource(buildPath, process.platform, "native-runtime", identity),
        );
      }
      if (workerCompanionSource) {
        await copyContainedResource(
          workerCompanionSource,
          packagedDesktopMacOSWorkerCompanion(buildPath, process.platform, identity),
        );
      }
    },
  ],
  afterCopy: [
    async ({ buildPath }) => {
      await stageDesktopRuntimeDependencies(buildPath);
      if (identity === DESKTOP_PREVIEW_IDENTITY) {
        await writeFile(
          join(buildPath, "package.json"),
          `${JSON.stringify(desktopPackagedManifest(packageManifest, identity), null, 2)}\n`,
        );
      }
    },
  ],
  executableName: identity.executableName,
  ignore: (candidatePath) => shouldIgnoreDesktopSource(appRoot, candidatePath),
  icon: desktopIconBase,
  name: identity.name,
  out:
    identity === DESKTOP_PREVIEW_IDENTITY ? join(appRoot, "out", "preview") : join(appRoot, "out"),
  overwrite: true,
  platform: process.platform,
  prune: false,
  win32metadata: DESKTOP_WINDOWS_METADATA,
});

if (packagePaths.length !== 1) {
  throw new Error(`Expected one Desktop package, received ${packagePaths.length}.`);
}

const target = packagedElectronTarget(packagePaths[0], process.platform, identity);
const asarPath = packagedAsarPath(packagePaths[0], process.platform, identity);
validateDesktopAsarEntries(listPackage(asarPath, { isPack: false }));
const expectedFuses = createDesktopFuseConfig(process.platform, process.arch);
await flipFuses(target, expectedFuses);

await access(
  packagedDesktopResource(packagePaths[0], process.platform, DESKTOP_ICON_RESOURCE_NAME, identity),
);

const actualFuses = await getCurrentFuseWire(target);
for (const fuseIndex of Object.values(FuseV1Options).filter((value) => typeof value === "number")) {
  const expectedState = expectedFuses[fuseIndex] ? FuseState.ENABLE : FuseState.DISABLE;
  if (actualFuses[fuseIndex] !== expectedState) {
    throw new Error(`Packaged Desktop fuse ${FuseV1Options[fuseIndex]} did not match policy.`);
  }
}

const packagedWorkerCompanion = packagedDesktopMacOSWorkerCompanion(
  packagePaths[0],
  process.platform,
  identity,
);
if (workerCompanionSource !== undefined) {
  if (packagedWorkerCompanion === undefined) {
    throw new Error("Desktop package did not resolve its macOS Worker companion.");
  }
  await validateMacOSWorkerHostApplication(packagedWorkerCompanion, {
    expectedOwner: process.getuid?.(),
  });
} else if (packagedWorkerCompanion !== undefined) {
  try {
    await access(packagedWorkerCompanion);
    throw new Error("Desktop package contains an undeclared macOS Worker companion.");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log(
  `Packaged unsigned ${identity.name} development artifact${
    workerCompanionSource === undefined ? " without" : " with"
  } the macOS Worker companion: ${packagePaths[0]}`,
);

async function stageDesktopRuntimeDependencies(buildPath) {
  const destinationRoot = join(buildPath, "node_modules");
  await mkdir(destinationRoot, { recursive: true });
  for (const [name, expectedVersion] of Object.entries(DESKTOP_RUNTIME_DEPENDENCIES)) {
    const source = join(workspaceRoot, "node_modules", name);
    const manifest = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
    if (manifest.name !== name || manifest.version !== expectedVersion) {
      throw new Error(`Desktop runtime dependency ${name} did not match ${expectedVersion}.`);
    }
    await cp(source, join(destinationRoot, name), {
      errorOnExist: true,
      force: false,
      recursive: true,
    });
  }
}
