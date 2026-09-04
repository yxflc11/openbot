import { constants } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";

export const LINUX_PRIVILEGED_INSTALL_LAYOUT = Object.freeze({
  importsRoot: "/var/lib/openbot-node-installer/imports",
  installRoot: "/opt/openbot-node",
  stagingRoot: "/opt/openbot-node/staging",
  stateRoot: "/var/lib/openbot-node-installer",
  versionsRoot: "/opt/openbot-node/versions",
});

const layoutPolicy = Object.freeze([
  Object.freeze({ mode: "ancestor", path: "/" }),
  Object.freeze({ mode: "ancestor", path: "/opt" }),
  Object.freeze({ mode: 0o755, path: LINUX_PRIVILEGED_INSTALL_LAYOUT.installRoot }),
  Object.freeze({ mode: 0o700, path: LINUX_PRIVILEGED_INSTALL_LAYOUT.stagingRoot }),
  Object.freeze({ mode: 0o755, path: LINUX_PRIVILEGED_INSTALL_LAYOUT.versionsRoot }),
  Object.freeze({ mode: "ancestor", path: "/var" }),
  Object.freeze({ mode: "ancestor", path: "/var/lib" }),
  Object.freeze({ mode: 0o700, path: LINUX_PRIVILEGED_INSTALL_LAYOUT.stateRoot }),
  Object.freeze({ mode: 0o700, path: LINUX_PRIVILEGED_INSTALL_LAYOUT.importsRoot }),
]);

export async function assertLinuxPrivilegedInstallerLayout() {
  const runtime = currentRuntime();
  validateLinuxPrivilegedRuntime(runtime);
  const snapshot = await readLayoutSnapshot({ lstat });
  validateLinuxPrivilegedLayoutSnapshot(snapshot);
  return LINUX_PRIVILEGED_INSTALL_LAYOUT;
}

export async function prepareLinuxPrivilegedInstallerLayout() {
  return await provisionLinuxPrivilegedInstallerLayout(currentRuntime(), {
    lstat,
    mkdir,
    openDirectory: async (directoryPath) =>
      await open(directoryPath, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW),
  });
}

/**
 * Deterministic syscall core for policy tests. Paths, owners, and modes remain fixed; only the
 * privileged wrapper above supplies the real Linux runtime and no-follow directory handles.
 */
export async function provisionLinuxPrivilegedInstallerLayout(runtime, operations) {
  validateLinuxPrivilegedRuntime(runtime);
  validateProvisionOperations(operations);

  // Validate every mutable ancestor before the first write. Children are then handled in strict
  // parent-first order, so a partial failure can leave only already-validated private directories.
  const ancestorSnapshot = Object.fromEntries(
    await Promise.all(
      layoutPolicy
        .filter((entry) => entry.mode === "ancestor")
        .map(async (entry) => [entry.path, await operations.lstat(entry.path)]),
    ),
  );
  for (const policy of layoutPolicy.filter((entry) => entry.mode === "ancestor")) {
    validateLayoutEntry(policy, ancestorSnapshot[policy.path]);
  }

  for (const policy of layoutPolicy.filter((entry) => entry.mode !== "ancestor")) {
    const existing = await lstatIfPresent(operations, policy.path);
    if (existing !== undefined) {
      validateLayoutEntry(policy, existing);
      continue;
    }

    try {
      await operations.mkdir(policy.path, { mode: policy.mode, recursive: false });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      validateLayoutEntry(policy, await operations.lstat(policy.path));
      continue;
    }
    await normalizeCreatedDirectory(operations, policy);
  }

  const snapshot = await readLayoutSnapshot(operations);
  validateLinuxPrivilegedLayoutSnapshot(snapshot);
  return LINUX_PRIVILEGED_INSTALL_LAYOUT;
}

function currentRuntime() {
  return {
    effectiveGroupId: typeof process.getegid === "function" ? process.getegid() : undefined,
    effectiveUserId: typeof process.geteuid === "function" ? process.geteuid() : undefined,
    platform: process.platform,
  };
}

export function validateLinuxPrivilegedRuntime(runtime) {
  if (
    !isRecord(runtime) ||
    runtime.platform !== "linux" ||
    runtime.effectiveUserId !== 0 ||
    runtime.effectiveGroupId !== 0
  ) {
    throw new Error("Linux privileged installer must run as root on Linux.");
  }
}

export function validateLinuxPrivilegedLayoutSnapshot(snapshot) {
  if (!isRecord(snapshot)) throw new Error("Linux privileged layout snapshot is malformed.");
  const expectedPaths = layoutPolicy.map((entry) => entry.path).sort();
  if (JSON.stringify(Object.keys(snapshot).sort()) !== JSON.stringify(expectedPaths)) {
    throw new Error("Linux privileged layout snapshot has missing or unknown paths.");
  }

  for (const policy of layoutPolicy) {
    validateLayoutEntry(policy, snapshot[policy.path]);
  }

  const installDevice = snapshot[LINUX_PRIVILEGED_INSTALL_LAYOUT.installRoot].dev;
  if (
    snapshot[LINUX_PRIVILEGED_INSTALL_LAYOUT.stagingRoot].dev !== installDevice ||
    snapshot[LINUX_PRIVILEGED_INSTALL_LAYOUT.versionsRoot].dev !== installDevice
  ) {
    throw new Error("Linux staging and versions roots must share the install filesystem.");
  }
  const stateDevice = snapshot[LINUX_PRIVILEGED_INSTALL_LAYOUT.stateRoot].dev;
  if (snapshot[LINUX_PRIVILEGED_INSTALL_LAYOUT.importsRoot].dev !== stateDevice) {
    throw new Error("Linux imports and installer state roots must share one filesystem.");
  }
  return LINUX_PRIVILEGED_INSTALL_LAYOUT;
}

async function normalizeCreatedDirectory(operations, policy) {
  const handle = await operations.openDirectory(policy.path);
  if (
    !isRecord(handle) ||
    typeof handle.chmod !== "function" ||
    typeof handle.close !== "function" ||
    typeof handle.stat !== "function"
  ) {
    throw new Error("Linux privileged layout directory handle is malformed.");
  }
  try {
    const created = await handle.stat();
    validateRootDirectory(policy.path, created);
    if ((created.mode & 0o777 & ~policy.mode) !== 0) {
      throw new Error(
        `Linux privileged layout created an over-permissive directory: ${policy.path}`,
      );
    }
    await handle.chmod(policy.mode);
    const normalized = await handle.stat();
    validateLayoutEntry(policy, normalized);
    assertSameDirectory(created, normalized, policy.path);
    const selected = await operations.lstat(policy.path);
    validateLayoutEntry(policy, selected);
    assertSameDirectory(normalized, selected, policy.path);
  } finally {
    await handle.close();
  }
}

async function readLayoutSnapshot(operations) {
  return Object.fromEntries(
    await Promise.all(
      layoutPolicy.map(async (entry) => [entry.path, await operations.lstat(entry.path)]),
    ),
  );
}

async function lstatIfPresent(operations, entryPath) {
  try {
    return await operations.lstat(entryPath);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function validateProvisionOperations(operations) {
  if (
    !isRecord(operations) ||
    typeof operations.lstat !== "function" ||
    typeof operations.mkdir !== "function" ||
    typeof operations.openDirectory !== "function"
  ) {
    throw new Error("Linux privileged layout operations are malformed.");
  }
}

function validateLayoutEntry(policy, metadata) {
  validateRootDirectory(policy.path, metadata);
  const actualMode = metadata.mode & 0o777;
  if (policy.mode === "ancestor") {
    if ((actualMode & 0o700) !== 0o700 || (actualMode & 0o022) !== 0) {
      throw new Error(
        `Linux privileged layout ancestor is writable or inaccessible: ${policy.path}`,
      );
    }
  } else if (actualMode !== policy.mode) {
    throw new Error(`Linux privileged layout path has the wrong mode: ${policy.path}`);
  }
}

function validateRootDirectory(entryPath, metadata) {
  if (
    !isStatLike(metadata) ||
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== 0 ||
    metadata.gid !== 0
  ) {
    throw new Error(
      `Linux privileged layout path is not a real root-owned directory: ${entryPath}`,
    );
  }
}

function assertSameDirectory(before, after, entryPath) {
  if (before.dev !== after.dev || before.ino !== after.ino) {
    throw new Error(`Linux privileged layout directory changed during creation: ${entryPath}`);
  }
}

function isStatLike(value) {
  return (
    isRecord(value) &&
    typeof value.isDirectory === "function" &&
    typeof value.isSymbolicLink === "function" &&
    Number.isSafeInteger(value.uid) &&
    Number.isSafeInteger(value.gid) &&
    Number.isSafeInteger(value.mode) &&
    Number.isSafeInteger(value.dev) &&
    Number.isSafeInteger(value.ino)
  );
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
