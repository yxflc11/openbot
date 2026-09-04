import { lstat } from "node:fs/promises";

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
  validateLinuxPrivilegedRuntime({
    effectiveGroupId: typeof process.getegid === "function" ? process.getegid() : undefined,
    effectiveUserId: typeof process.geteuid === "function" ? process.geteuid() : undefined,
    platform: process.platform,
  });
  const snapshot = Object.fromEntries(
    await Promise.all(
      layoutPolicy.map(async (entry) => [entry.path, await lstat(entry.path)]),
    ),
  );
  validateLinuxPrivilegedLayoutSnapshot(snapshot);
  return LINUX_PRIVILEGED_INSTALL_LAYOUT;
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
    const metadata = snapshot[policy.path];
    if (
      !isStatLike(metadata) ||
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      metadata.uid !== 0 ||
      metadata.gid !== 0
    ) {
      throw new Error(`Linux privileged layout path is not a real root-owned directory: ${policy.path}`);
    }
    const actualMode = metadata.mode & 0o777;
    if (policy.mode === "ancestor") {
      if ((actualMode & 0o700) !== 0o700 || (actualMode & 0o022) !== 0) {
        throw new Error(`Linux privileged layout ancestor is writable or inaccessible: ${policy.path}`);
      }
    } else if (actualMode !== policy.mode) {
      throw new Error(`Linux privileged layout path has the wrong mode: ${policy.path}`);
    }
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

function isStatLike(value) {
  return (
    isRecord(value) &&
    typeof value.isDirectory === "function" &&
    typeof value.isSymbolicLink === "function" &&
    Number.isSafeInteger(value.uid) &&
    Number.isSafeInteger(value.gid) &&
    Number.isSafeInteger(value.mode) &&
    Number.isSafeInteger(value.dev)
  );
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
