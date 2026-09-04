import { lstat, mkdir, rmdir } from "node:fs/promises";
import path from "node:path";

const leaseRecords = new WeakMap();

/**
 * Holds the installer lock across archive import, verification, extraction, and activation. The
 * opaque lease proves only local serialization; it never grants Server or Node authority.
 */
export async function withLinuxInstallLease(options, operation) {
  if (!isRecord(options) || typeof operation !== "function") {
    throw new Error("Linux install lease request is malformed.");
  }
  const stateRoot = assertAbsoluteStateRoot(options.stateRoot);
  const lease = await acquireLinuxInstallLease(stateRoot);
  try {
    return await operation(lease);
  } finally {
    await releaseLinuxInstallLease(lease);
  }
}

/**
 * Lets a transaction either acquire its own lease or join an already-held outer bootstrap lease.
 * The returned release function never releases a caller-owned outer lease.
 */
export async function enterLinuxInstallLease(stateRootInput, lease) {
  const stateRoot = assertAbsoluteStateRoot(stateRootInput);
  if (lease === undefined) {
    const ownedLease = await acquireLinuxInstallLease(stateRoot);
    return async () => await releaseLinuxInstallLease(ownedLease);
  }
  await assertLinuxInstallLease(lease, stateRoot);
  return async () => await assertLinuxInstallLease(lease, stateRoot);
}

export async function assertLinuxInstallLease(lease, stateRootInput) {
  const stateRoot = assertAbsoluteStateRoot(stateRootInput);
  const record = isRecord(lease) ? leaseRecords.get(lease) : undefined;
  if (record === undefined || !record.active || record.stateRoot !== stateRoot) {
    throw new Error("Linux install lease is missing, released, forged, or belongs to another root.");
  }
  let rootMetadata;
  let lockMetadata;
  try {
    [rootMetadata, lockMetadata] = await Promise.all([
      lstat(record.stateRoot),
      lstat(record.lockPath),
    ]);
  } catch {
    throw new Error("Linux install lease was removed or replaced.");
  }
  if (
    !isPrivateDirectory(rootMetadata) ||
    !isPrivateDirectory(lockMetadata) ||
    !sameEntry(rootMetadata, record.stateIdentity) ||
    !sameEntry(lockMetadata, record.lockIdentity)
  ) {
    throw new Error("Linux install lease was removed or replaced.");
  }
}

async function acquireLinuxInstallLease(stateRoot) {
  const stateMetadata = await lstat(stateRoot);
  if (!isPrivateDirectory(stateMetadata)) {
    throw new Error("Linux install lease state root must be a private real directory.");
  }
  const lockPath = path.join(stateRoot, "transaction.lock");
  try {
    await mkdir(lockPath, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error("Another Linux install transaction or stale lock exists.");
    }
    throw error;
  }
  try {
    const [stateAfterLock, lockMetadata] = await Promise.all([lstat(stateRoot), lstat(lockPath)]);
    if (!isPrivateDirectory(stateAfterLock) || !isPrivateDirectory(lockMetadata)) {
      throw new Error("Linux install lease lock is not a private real directory.");
    }
    const lease = Object.freeze(Object.create(null));
    leaseRecords.set(lease, {
      active: true,
      lockIdentity: identityOf(lockMetadata, true),
      lockPath,
      stateIdentity: identityOf(stateAfterLock, false),
      stateRoot,
    });
    return lease;
  } catch (error) {
    await rmdir(lockPath);
    throw error;
  }
}

async function releaseLinuxInstallLease(lease) {
  const record = leaseRecords.get(lease);
  if (record === undefined || !record.active) {
    throw new Error("Linux install lease cannot be released twice.");
  }
  await assertLinuxInstallLease(lease, record.stateRoot);
  await rmdir(record.lockPath);
  record.active = false;
}

function assertAbsoluteStateRoot(value) {
  if (typeof value !== "string" || !path.isAbsolute(value)) {
    throw new Error("Linux install lease state root must be an absolute path.");
  }
  return path.resolve(value);
}

function isPrivateDirectory(metadata) {
  return (
    metadata.isDirectory() &&
    !metadata.isSymbolicLink() &&
    (metadata.mode & 0o777) === 0o700
  );
}

function identityOf(metadata, trackContentChanges) {
  return Object.freeze({
    ctimeMs: trackContentChanges ? metadata.ctimeMs : undefined,
    dev: metadata.dev,
    ino: metadata.ino,
    mode: metadata.mode,
  });
}

function sameEntry(metadata, identity) {
  return (
    metadata.dev === identity.dev &&
    metadata.ino === identity.ino &&
    metadata.mode === identity.mode &&
    (identity.ctimeMs === undefined || metadata.ctimeMs === identity.ctimeMs)
  );
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
