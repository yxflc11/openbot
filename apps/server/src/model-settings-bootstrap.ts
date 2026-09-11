import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  createWindowsSecretAcl,
  ensureProtectedSecretDirectory,
  protectSecretFile,
  verifySecretFileAccess,
  type WindowsSecretAcl,
} from "@openbot/windows-secret-acl";
import { ModelSettingsService } from "./model-settings.js";

export interface ModelSettingsLocation {
  OPENBOT_MODEL_DIRECTORY?: string | undefined;
  OPENBOT_MODEL_SETTINGS_PATH?: string | undefined;
  OPENBOT_MODEL_ENCRYPTION_KEY?: string | undefined;
}

export interface BootstrapModelSettingsOptions {
  fetcher?: typeof fetch;
  windowsAcl?: WindowsSecretAcl;
  windowsTrustRoot?: string;
}

/** The directory belongs to the Server account, never to a renderer or Worker. */
export async function bootstrapModelSettings(
  location: ModelSettingsLocation,
  fetcherOrOptions: typeof fetch | BootstrapModelSettingsOptions = fetch,
): Promise<ModelSettingsService | undefined> {
  const options: BootstrapModelSettingsOptions =
    typeof fetcherOrOptions === "function" ? { fetcher: fetcherOrOptions } : fetcherOrOptions;
  const fetcher = options.fetcher ?? fetch;
  // One long-lived ACL helper for bootstrap + returned service (Owner SID reuse; ACL re-verify each op).
  const windowsAcl = options.windowsAcl ?? createWindowsSecretAcl();
  const windowsTrustRoot = options.windowsTrustRoot;
  const aclOptions = {
    acl: windowsAcl,
    ...(windowsTrustRoot === undefined ? {} : { trustRoot: windowsTrustRoot }),
  };
  const directory = location.OPENBOT_MODEL_DIRECTORY;
  const legacyPath = location.OPENBOT_MODEL_SETTINGS_PATH;
  const legacyKey = location.OPENBOT_MODEL_ENCRYPTION_KEY;
  if (directory !== undefined && (legacyPath !== undefined || legacyKey !== undefined)) {
    throw new Error(
      "Configure one model storage location, not both directory and legacy settings.",
    );
  }
  if (directory === undefined) {
    if ((legacyPath === undefined) !== (legacyKey === undefined)) {
      throw new Error("Model settings path and encryption key must be configured together.");
    }
    return legacyPath && legacyKey
      ? new ModelSettingsService(legacyPath, legacyKey, fetcher, {
          windowsAcl,
          ...(windowsTrustRoot === undefined ? {} : { windowsTrustRoot }),
        })
      : undefined;
  }

  const root = resolve(directory);
  const settingsPath = join(root, "settings.json");
  const keyPath = join(root, "encryption.key");
  try {
    await ensureProtectedSecretDirectory(root, aclOptions);
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || !isPrivate(rootStat, 0o077))
      throw new Error("Invalid directory.");
    try {
      await lstat(keyPath);
    } catch (error) {
      if (!isMissing(error)) throw error;
      // Losing the key is not a fresh installation. Never replace it beside retained ciphertext.
      try {
        await lstat(settingsPath);
        throw new Error("Model encryption key is missing for retained settings.");
      } catch (settingsError) {
        if (!isMissing(settingsError)) throw settingsError;
      }
      try {
        const handle = await open(keyPath, "wx", 0o600);
        try {
          await handle.writeFile(randomBytes(32).toString("hex"), "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        await protectSecretFile(keyPath, { acl: windowsAcl });
      } catch (createError) {
        // Another startup may have created the key. Read and validate that exact file below.
        if (
          !(createError instanceof Error && "code" in createError && createError.code === "EEXIST")
        ) {
          throw createError;
        }
      }
    }
    const keyStat = await lstat(keyPath);
    if (
      !keyStat.isFile() ||
      keyStat.nlink !== 1 ||
      !isPrivate(keyStat, 0o177) ||
      keyStat.size !== 64
    ) {
      throw new Error("Invalid model encryption key file.");
    }
    await verifySecretFileAccess(keyPath, aclOptions);
    const handle = await open(keyPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let key: string;
    try {
      const opened = await handle.stat();
      if (opened.ino !== keyStat.ino || opened.dev !== keyStat.dev) throw new Error("Key changed.");
      const buffer = Buffer.alloc(65);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      key = buffer.subarray(0, bytesRead).toString("utf8");
      if (!/^[a-f0-9]{64}$/u.test(key)) throw new Error("Invalid encryption key.");
    } finally {
      await handle.close();
    }
    const service = new ModelSettingsService(settingsPath, key, fetcher, {
      windowsAcl,
      ...(windowsTrustRoot === undefined ? {} : { windowsTrustRoot }),
    });
    await service.summary();
    return service;
  } catch {
    // Do not serialize filesystem errors, paths, keys or ciphertext into startup logs.
    throw new Error(
      "Model storage is unavailable. Restore its private directory and encryption key.",
    );
  }
}

function isPrivate(stat: { uid: number; mode: number }, mask: number): boolean {
  return (
    process.platform === "win32" || (stat.uid === process.getuid?.() && (stat.mode & mask) === 0)
  );
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
