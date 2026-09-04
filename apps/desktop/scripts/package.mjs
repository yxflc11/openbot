import { flipFuses, FuseState, FuseV1Options, getCurrentFuseWire } from "@electron/fuses";
import { packager } from "@electron/packager";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDesktopFuseConfig,
  packagedElectronTarget,
  shouldIgnoreDesktopSource,
} from "./package-policy.mjs";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
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
  executableName: "openbot",
  ignore: (candidatePath) => shouldIgnoreDesktopSource(appRoot, candidatePath),
  name: "OpenBot",
  out: join(appRoot, "out"),
  overwrite: true,
  platform: process.platform,
  prune: false,
});

if (packagePaths.length !== 1) {
  throw new Error(`Expected one Desktop package, received ${packagePaths.length}.`);
}

const target = packagedElectronTarget(packagePaths[0], process.platform);
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
