import { flipFuses, FuseState, FuseV1Options, getCurrentFuseWire } from "@electron/fuses";
import { packager } from "@electron/packager";
import { listPackage } from "@electron/asar";
import { access, cp, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDesktopFuseConfig,
  desktopMacOSWorkerCompanionSource,
  DESKTOP_RUNTIME_DEPENDENCIES,
  DESKTOP_WINDOWS_METADATA,
  packagedAsarPath,
  packagedDesktopMacOSWorkerCompanion,
  packagedElectronTarget,
  shouldIgnoreDesktopSource,
  validateDesktopAsarEntries,
} from "./package-policy.mjs";
import { validateMacOSWorkerHostApplication } from "../../../scripts/macos-worker-host-release.mjs";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = join(appRoot, "..", "..");
const rendererEntry = join(appRoot, "dist", "renderer", "index.html");
const packageManifest = JSON.parse(await readFile(join(appRoot, "package.json"), "utf8"));
const workerCompanionSource = desktopMacOSWorkerCompanionSource(
  process.env.OPENBOT_DESKTOP_MACOS_WORKER_COMPANION,
  process.platform,
);

await access(rendererEntry);
if (workerCompanionSource !== undefined) {
  await validateMacOSWorkerHostApplication(workerCompanionSource, {
    expectedOwner: process.getuid?.(),
  });
}

const packagePaths = await packager({
  appBundleId: "dev.openbot.desktop",
  appVersion: packageManifest.version,
  arch: process.arch,
  asar: true,
  dir: appRoot,
  electronVersion: "44.2.0",
  ...(workerCompanionSource === undefined ? {} : { extraResource: [workerCompanionSource] }),
  afterCopy: [async ({ buildPath }) => stageDesktopRuntimeDependencies(buildPath)],
  executableName: "openbot",
  ignore: (candidatePath) => shouldIgnoreDesktopSource(appRoot, candidatePath),
  name: "OpenBot",
  out: join(appRoot, "out"),
  overwrite: true,
  platform: process.platform,
  prune: false,
  win32metadata: DESKTOP_WINDOWS_METADATA,
});

if (packagePaths.length !== 1) {
  throw new Error(`Expected one Desktop package, received ${packagePaths.length}.`);
}

const target = packagedElectronTarget(packagePaths[0], process.platform);
const asarPath = packagedAsarPath(packagePaths[0], process.platform);
validateDesktopAsarEntries(listPackage(asarPath, { isPack: false }));
const expectedFuses = createDesktopFuseConfig(process.platform, process.arch);
await flipFuses(target, expectedFuses);

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
  `Packaged unsigned OpenBot Desktop development artifact${
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
