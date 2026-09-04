import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { chmod, copyFile, lstat, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";

export const NODE_RUNTIME_VERSION = "22.22.2";
export const NCC_VERSION = "0.45.0";
export const RELEASE_NPM_VERSION = "10.9.8";

export const NODE_RUNTIME_TARGETS = Object.freeze({
  x64: Object.freeze({
    directory: `node-v${NODE_RUNTIME_VERSION}-linux-x64`,
    filename: `node-v${NODE_RUNTIME_VERSION}-linux-x64.tar.xz`,
    sha256: "88fd1ce767091fd8d4a99fdb2356e98c819f93f3b1f8663853a2dee9b438068a",
  }),
  arm64: Object.freeze({
    directory: `node-v${NODE_RUNTIME_VERSION}-linux-arm64`,
    filename: `node-v${NODE_RUNTIME_VERSION}-linux-arm64.tar.xz`,
    sha256: "e9e1930fd321a470e29bb68f30318bf58e3ecb4acb4f1533fb19c58328a091fe",
  }),
});

const EXPECTED_NCC_ASSETS = Object.freeze([
  "file.js",
  "index.js",
  "third-party-licenses.txt",
  "worker.js",
  "worker1.js",
]);
const EXPECTED_NCC_OUTPUTS = Object.freeze([...EXPECTED_NCC_ASSETS, "package.json"].sort());
const EXPECTED_OPTIONAL_STUBS = new Set(["bufferutil", "utf-8-validate"]);
const EXPECTED_INTERNAL_LICENSE_WARNINGS = new Set(
  [
    "@openbot/node",
    "@openbot/config",
    "@openbot/logging",
    "@openbot/protocol",
    "@openbot/provider-sdk",
    "@openbot/provider-docker",
  ].map(
    (name) =>
      `license-webpack-plugin: could not find any license file for ${name}. Use the licenseTextOverrides option to add the license text if desired.`,
  ),
);
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const FORBIDDEN_RELEASE_PACKAGES = new Set([
  "@openbot/provider-coder",
  "@openbot/provider-cua",
  "@openbot/provider-lume",
  "@vercel/ncc",
  "tsx",
  "typescript",
  "vitest",
]);

export function assertReleaseVersion(version) {
  if (
    typeof version !== "string" ||
    version.length > 64 ||
    !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)
  ) {
    throw new Error("Release version must be a bounded SemVer value.");
  }
  return version;
}

export function assertSourceCommit(commit) {
  if (typeof commit !== "string" || !/^[0-9a-f]{40}$/.test(commit)) {
    throw new Error("Source commit must be a full lowercase Git SHA-1.");
  }
  return commit;
}

export function assertSourceDateEpoch(value) {
  const epoch = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(epoch) || epoch < 0 || epoch > 4_102_444_800) {
    throw new Error("Source date epoch must be an integer between 1970 and 2100.");
  }
  return epoch;
}

export function assertSourceTreeState(sourceCommit, headCommit, porcelainStatus) {
  assertSourceCommit(sourceCommit);
  if (headCommit.trim() !== sourceCommit)
    throw new Error("Source commit does not match repository HEAD.");
  if (porcelainStatus.trim() !== "")
    throw new Error("Release candidate requires a clean source tree.");
}

export async function sha256File(filePath) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

export async function verifyNodeRuntimeArchive(filePath, architecture) {
  const target = NODE_RUNTIME_TARGETS[architecture];
  if (target === undefined) throw new Error("Linux runtime architecture must be x64 or arm64.");
  const metadata = await stat(filePath);
  if (!metadata.isFile() || metadata.size < 20 * 1024 * 1024 || metadata.size > 40 * 1024 * 1024) {
    throw new Error("Node runtime archive size is outside the reviewed bound.");
  }
  const actual = await sha256File(filePath);
  if (actual !== target.sha256)
    throw new Error("Node runtime archive SHA-256 does not match the pin.");
  return target;
}

export function collectProductionPackageGraph(lockfile) {
  if (lockfile?.lockfileVersion !== 3 || !isRecord(lockfile.packages)) {
    throw new Error("Release packaging requires an npm lockfileVersion 3 package graph.");
  }
  const packages = lockfile.packages;
  const workspaceByName = new Map();
  for (const [packageKey, entry] of Object.entries(packages)) {
    if (packageKey !== "" && !packageKey.includes("node_modules") && isRecord(entry)) {
      if (typeof entry.name !== "string" || workspaceByName.has(entry.name)) {
        throw new Error("Workspace package names must be present and unique.");
      }
      workspaceByName.set(entry.name, packageKey);
    }
  }

  const workspaceKeys = new Set();
  const packageKeys = new Set();
  const visiting = new Set();

  const visit = (packageKey) => {
    if (workspaceKeys.has(packageKey) || packageKeys.has(packageKey)) return;
    if (visiting.has(packageKey))
      throw new Error(`Dependency cycle is ambiguous at ${packageKey}.`);
    const entry = packages[packageKey];
    if (!isRecord(entry)) throw new Error(`Dependency lock entry is missing: ${packageKey}.`);
    if (entry.dev === true)
      throw new Error(`Production dependency is marked development-only: ${packageKey}.`);
    visiting.add(packageKey);
    if (packageKey.includes("node_modules")) packageKeys.add(packageKey);
    else workspaceKeys.add(packageKey);

    for (const dependencyName of Object.keys(entry.dependencies ?? {}).sort()) {
      const workspaceKey = workspaceByName.get(dependencyName);
      if (workspaceKey !== undefined) {
        const link = packages[`node_modules/${dependencyName}`];
        if (!isRecord(link) || link.link !== true || link.resolved !== workspaceKey) {
          throw new Error(`Workspace dependency link is invalid: ${dependencyName}.`);
        }
        visit(workspaceKey);
        continue;
      }
      const dependencyKey = resolvePackageKey(packages, packageKey, dependencyName);
      if (dependencyKey === undefined) {
        throw new Error(`Production dependency is unresolved: ${packageKey} -> ${dependencyName}.`);
      }
      visit(dependencyKey);
    }

    for (const dependencyName of Object.keys(entry.optionalDependencies ?? {}).sort()) {
      const dependencyKey = resolvePackageKey(packages, packageKey, dependencyName);
      if (dependencyKey !== undefined) visit(dependencyKey);
    }
    visiting.delete(packageKey);
  };

  visit("apps/node");
  return {
    workspaceKeys: [...workspaceKeys].sort(),
    packageKeys: [...packageKeys].sort(),
  };
}

export async function writeProductionSbomProjection({ destination, lockfile, version }) {
  assertReleaseVersion(version);
  const graph = collectProductionPackageGraph(lockfile);
  const packages = lockfile.packages;
  const root = {
    name: "openbot-node-linux-runtime",
    version,
    private: true,
    license: "MIT",
    workspaces: graph.workspaceKeys,
  };
  const projectedPackages = { "": root };

  for (const workspaceKey of graph.workspaceKeys) {
    const source = packages[workspaceKey];
    const projected = projectPackageEntry(source, true);
    projectedPackages[workspaceKey] = projected;
    projectedPackages[`node_modules/${projected.name}`] = { link: true, resolved: workspaceKey };
    await mkdir(path.join(destination, workspaceKey), { recursive: true });
    await writeJson(path.join(destination, workspaceKey, "package.json"), projected);
  }
  for (const packageKey of graph.packageKeys) {
    projectedPackages[packageKey] = projectPackageEntry(packages[packageKey], false);
  }

  const projectedLock = {
    name: root.name,
    version,
    lockfileVersion: 3,
    requires: true,
    packages: Object.fromEntries(
      Object.entries(projectedPackages).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
  await mkdir(destination, { recursive: true });
  await writeJson(path.join(destination, "package.json"), root);
  await writeJson(path.join(destination, "package-lock.json"), projectedLock);
  return graph;
}

export function validateSpdxSbom(sbom, graph, lockfile) {
  if (sbom?.spdxVersion !== "SPDX-2.3" || !Array.isArray(sbom.packages)) {
    throw new Error("Release SBOM must be an SPDX 2.3 document.");
  }
  const actual = new Set(
    sbom.packages.map((entry) => entry?.name).filter((name) => typeof name === "string"),
  );
  for (const forbidden of FORBIDDEN_RELEASE_PACKAGES) {
    if (actual.has(forbidden))
      throw new Error(`Release SBOM contains a non-production package: ${forbidden}.`);
  }
  for (const packageKey of [...graph.workspaceKeys, ...graph.packageKeys]) {
    const expectedName = lockfile.packages[packageKey]?.name ?? packageNameFromLockKey(packageKey);
    if (!actual.has(expectedName)) throw new Error(`Release SBOM is missing ${expectedName}.`);
  }
  return sbom;
}

export function canonicalizeSpdxSbom(sbom, metadata) {
  const version = assertReleaseVersion(metadata.version);
  const sourceCommit = assertSourceCommit(metadata.sourceCommit);
  const sourceDateEpoch = assertSourceDateEpoch(metadata.sourceDateEpoch);
  if (NODE_RUNTIME_TARGETS[metadata.architecture] === undefined) {
    throw new Error("Linux SBOM architecture must be x64 or arm64.");
  }
  const canonical = structuredClone(sbom);
  if (!isRecord(canonical.creationInfo) || !Array.isArray(canonical.creationInfo.creators)) {
    throw new Error("Release SBOM creation information is missing.");
  }
  if (!canonical.creationInfo.creators.includes(`Tool: npm/cli-${RELEASE_NPM_VERSION}`)) {
    throw new Error(`Release SBOM was not generated by npm ${RELEASE_NPM_VERSION}.`);
  }
  canonical.name = `openbot-node-${version}-linux-${metadata.architecture}`;
  canonical.documentNamespace = `https://openbot.dev/spdx/openbot-node/${version}/linux/${metadata.architecture}/${sourceCommit}`;
  canonical.creationInfo.created = new Date(sourceDateEpoch * 1000).toISOString();
  canonical.creationInfo.creators.sort();
  canonical.packages.sort((left, right) => String(left.SPDXID).localeCompare(String(right.SPDXID)));
  if (Array.isArray(canonical.relationships)) {
    canonical.relationships.sort((left, right) =>
      `${left.spdxElementId}\0${left.relationshipType}\0${left.relatedSpdxElement}`.localeCompare(
        `${right.spdxElementId}\0${right.relationshipType}\0${right.relatedSpdxElement}`,
      ),
    );
  }
  return canonical;
}

export function validateNccStats(stats, outputNames) {
  if (!isRecord(stats) || stats.errorsCount !== 0 || !Array.isArray(stats.warnings)) {
    throw new Error("ncc reported build errors or an invalid warning set.");
  }
  const warnings = stats.warnings.map((warning) => warning?.message);
  if (
    stats.warningsCount !== EXPECTED_INTERNAL_LICENSE_WARNINGS.size ||
    warnings.some((warning) => !EXPECTED_INTERNAL_LICENSE_WARNINGS.has(warning)) ||
    new Set(warnings).size !== EXPECTED_INTERNAL_LICENSE_WARNINGS.size
  ) {
    throw new Error("ncc reported an unexpected build warning.");
  }
  const assets = (stats.assets ?? []).map((asset) => asset?.name).sort();
  if (JSON.stringify(assets) !== JSON.stringify(EXPECTED_NCC_ASSETS)) {
    throw new Error("ncc emitted an unexpected asset set.");
  }
  if (JSON.stringify([...outputNames].sort()) !== JSON.stringify(EXPECTED_NCC_OUTPUTS)) {
    throw new Error("ncc output directory contains unexpected files.");
  }
  for (const module of stats.modules ?? []) {
    const name = module?.name;
    if (typeof name !== "string") continue;
    const external = /^external "([^"]+)"$/.exec(name)?.[1];
    if (external !== undefined && !BUILTINS.has(external)) {
      throw new Error(`ncc left a non-builtin dependency external: ${external}.`);
    }
    const missing = /@@notfound\.js\?(.+)$/.exec(name)?.[1];
    if (missing !== undefined && !EXPECTED_OPTIONAL_STUBS.has(missing)) {
      throw new Error(`ncc emitted an unexpected missing-module stub: ${missing}.`);
    }
  }
}

export async function createFileManifest(root, metadata) {
  if (NODE_RUNTIME_TARGETS[metadata.architecture] === undefined) {
    throw new Error("Linux manifest architecture must be x64 or arm64.");
  }
  const sourceDateEpoch = assertSourceDateEpoch(metadata.sourceDateEpoch);
  const files = [];
  let totalSize = 0;
  await walk(root, "", files, (size) => {
    totalSize += size;
    if (totalSize > 256 * 1024 * 1024)
      throw new Error("Release payload exceeds the total size bound.");
  });
  if (files.length > 256) throw new Error("Release payload exceeds the file-count bound.");
  return {
    schemaVersion: 1,
    product: "openbot-node",
    platform: "linux",
    architecture: metadata.architecture,
    version: assertReleaseVersion(metadata.version),
    sourceCommit: assertSourceCommit(metadata.sourceCommit),
    sourceDate: new Date(sourceDateEpoch * 1000).toISOString(),
    runtime: {
      name: "node",
      version: NODE_RUNTIME_VERSION,
      archiveSha256: NODE_RUNTIME_TARGETS[metadata.architecture]?.sha256,
    },
    signed: false,
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export async function writeChecksums(root, relativePaths, destination) {
  const lines = [];
  for (const relativePath of [...relativePaths].sort()) {
    assertRelativeArchivePath(relativePath);
    lines.push(`${await sha256File(path.join(root, relativePath))}  ${relativePath}`);
  }
  await writeFile(destination, `${lines.join("\n")}\n`, {
    encoding: "utf8",
    mode: 0o644,
    flag: "wx",
  });
}

export async function copyReleaseFile(source, destination, mode = 0o644) {
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  await chmod(destination, mode);
}

export async function listRegularFiles(root) {
  const files = [];
  await walk(root, "", files, () => undefined);
  return files.map((entry) => entry.path);
}

function resolvePackageKey(packages, fromKey, dependencyName) {
  let cursor = fromKey;
  while (cursor !== "") {
    const nested = `${cursor}/node_modules/${dependencyName}`;
    if (isRecord(packages[nested]) && packages[nested].link !== true) return nested;
    const marker = cursor.lastIndexOf("/node_modules/");
    if (marker === -1) break;
    cursor = cursor.slice(0, marker);
  }
  const root = `node_modules/${dependencyName}`;
  return isRecord(packages[root]) && packages[root].link !== true ? root : undefined;
}

function projectPackageEntry(entry, workspace) {
  if (!isRecord(entry)) throw new Error("Package projection received an invalid lock entry.");
  const projected = { ...entry };
  delete projected.dev;
  delete projected.devDependencies;
  if (workspace) projected.license = "MIT";
  return projected;
}

function packageNameFromLockKey(packageKey) {
  const marker = packageKey.lastIndexOf("node_modules/");
  return packageKey.slice(marker + "node_modules/".length);
}

async function walk(root, relative, files, addSize) {
  const current = relative === "" ? root : path.join(root, relative);
  for (const name of (await readdir(current)).sort()) {
    const childRelative = relative === "" ? name : `${relative}/${name}`;
    assertRelativeArchivePath(childRelative);
    const child = path.join(root, childRelative);
    const metadata = await lstat(child);
    if (metadata.isSymbolicLink())
      throw new Error(`Release payload contains a symbolic link: ${childRelative}.`);
    if (metadata.isDirectory()) {
      await walk(root, childRelative, files, addSize);
      continue;
    }
    if (!metadata.isFile() || metadata.size > 160 * 1024 * 1024) {
      throw new Error(`Release payload contains an unsupported file: ${childRelative}.`);
    }
    addSize(metadata.size);
    files.push({
      path: childRelative,
      size: metadata.size,
      mode: (metadata.mode & 0o777).toString(8).padStart(4, "0"),
      sha256: await sha256File(child),
    });
  }
}

function assertRelativeArchivePath(value) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 240 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error("Release payload path is unsafe.");
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o644,
    flag: "wx",
  });
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
