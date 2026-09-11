import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";

export const DESKTOP_INSTALLER_FORMAT = "openbot.desktop-installers/v1";
export const DESKTOP_INSTALLER_TARGETS = Object.freeze({
  "darwin-arm64": { builderPlatform: "mac", targets: ["dmg"], extensions: ["dmg"] },
  "win32-x64": { builderPlatform: "win", targets: ["nsis"], extensions: ["exe"] },
  "linux-x64": {
    builderPlatform: "linux",
    targets: ["AppImage", "deb"],
    extensions: ["AppImage", "deb"],
  },
});

export function installerTarget(platform, arch) {
  const target = DESKTOP_INSTALLER_TARGETS[`${platform}-${arch}`];
  if (!target)
    throw new Error("Desktop installers support only the three reviewed native targets.");
  return target;
}

export function validateInstallerVersion(version) {
  if (
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/u.test(version)
  ) {
    throw new Error("Use a numeric Desktop version with an optional alpha, beta, or rc suffix.");
  }
  if (version === "0.0.0")
    throw new Error("Installers require a version beyond the source placeholder.");
  return version;
}

export function installerFileNames(version, platform, arch) {
  validateInstallerVersion(version);
  return installerTarget(platform, arch).extensions.map(
    (extension) => `openbot-desktop-${version}-${platform}-${arch}.${extension}`,
  );
}

export function installerConfig({ appRoot, outputDirectory, version, platform, arch }) {
  installerTarget(platform, arch);
  validateInstallerVersion(version);
  return {
    extends: null,
    appId: "dev.openbot.desktop",
    productName: "OpenBot",
    electronVersion: "44.2.0",
    artifactName: `openbot-desktop-${version}-${platform}-${arch}.\${ext}`,
    directories: {
      app: appRoot,
      buildResources: join(appRoot, "resources"),
      output: outputDirectory,
    },
    extraMetadata: { version, productName: "OpenBot" },
    publish: null,
    npmRebuild: false,
    // The existing Packager output already has ASAR integrity and verified Electron 44 fuses.
    // prepackaged bypasses builder's packaging/signing pass; no automatic certificate discovery.
    mac: {
      identity: null,
      icon: "openbot-icon.icns",
      category: "public.app-category.productivity",
    },
    dmg: { sign: false },
    win: { executableName: "openbot", icon: "openbot-icon.ico", signAndEditExecutable: false },
    nsis: {
      oneClick: true,
      perMachine: false,
      runAfterFinish: false,
      deleteAppDataOnUninstall: false,
      packElevateHelper: false,
      createDesktopShortcut: false,
      createStartMenuShortcut: true,
      shortcutName: "OpenBot",
    },
    linux: {
      executableName: "openbot",
      icon: "openbot-icon.png",
      category: "Office",
      maintainer: "OpenBot contributors",
      synopsis: "Self-hosted digital employee workspace",
    },
  };
}

export async function hashInstaller(path) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.nlink !== 1 || stat.size < 1 || stat.size > 2 * 1024 ** 3) {
    throw new Error("Installer must be a regular file between one byte and two GiB.");
  }
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return { bytes: stat.size, sha256: hash.digest("hex") };
}

export async function verifyInstallerManifest(directory, expected = {}) {
  const manifestPath = join(directory, "manifest.json");
  const manifestStat = await lstat(manifestPath);
  if (!manifestStat.isFile() || manifestStat.nlink !== 1 || manifestStat.size > 16_384) {
    throw new Error("Installer manifest must be a bounded regular file.");
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    manifest.format !== DESKTOP_INSTALLER_FORMAT ||
    !["unsigned-development", "developer-id-notarized"].includes(manifest.signing) ||
    (manifest.signing === "developer-id-notarized" && manifest.platform !== "darwin") ||
    (manifest.sourceCommit !== null && !/^[a-f0-9]{40}$/u.test(manifest.sourceCommit)) ||
    !Array.isArray(manifest.files)
  )
    throw new Error("Invalid installer manifest.");
  for (const [key, value] of Object.entries(expected)) {
    if (manifest[key] !== value) throw new Error(`Installer ${key} did not match the release.`);
  }
  const names = installerFileNames(manifest.version, manifest.platform, manifest.arch);
  if (manifest.files.length !== names.length) throw new Error("Installer set is incomplete.");
  for (const name of names) {
    const entries = manifest.files.filter((entry) => entry.name === name);
    if (entries.length !== 1) throw new Error("Missing or duplicate installer asset.");
    const actual = await hashInstaller(join(directory, name));
    if (entries[0].bytes !== actual.bytes || entries[0].sha256 !== actual.sha256) {
      throw new Error("Installer checksum or size did not match its manifest.");
    }
  }
  return manifest;
}
