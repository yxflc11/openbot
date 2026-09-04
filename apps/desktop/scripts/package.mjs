import { flipFuses, FuseState, FuseV1Options, getCurrentFuseWire } from "@electron/fuses";
import { packager } from "@electron/packager";
import { listPackage } from "@electron/asar";
import { access, cp, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDesktopFuseConfig,
  DESKTOP_RUNTIME_DEPENDENCIES,
  DESKTOP_WINDOWS_METADATA,
  packagedAsarPath,
  packagedElectronTarget,
  shouldIgnoreDesktopSource,
  validateDesktopAsarEntries,
} from "./package-policy.mjs";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = join(appRoot, "..", "..");
const rendererEntry = join(appRoot, "dist", "renderer", "index.html");
const packageManifest = JSON.parse(await readFile(join(appRoot, "package.json"), "utf8"));

await access(rendererEntry);

const packagePaths = await packager({
  appBundleId: "dev.openbot.desktop",
  appVersion: packageManifest.version,
  arch: process.arch,
  asar: true,
  dir: appRoot,
  electronVersion: "44.2.0",
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

console.log(`Packaged unsigned OpenBot Desktop development artifact: ${packagePaths[0]}`);

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
