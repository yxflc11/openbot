import { type BigIntStats, constants } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
import { isAbsolute, join, normalize } from "node:path";
import { macOSNodeServiceConfigSchema, type NodeEnv, nodeEnvSchema } from "@openbot/config";

const maximumConfigBytes = 16 * 1024;
const requiredConfigMode = 0o600;
const macOSConfigRelativePath = [
  "Library",
  "Application Support",
  "OpenBot",
  "Node",
  "config.json",
];
const macOSWorkRelativePath = ["Library", "Application Support", "OpenBot", "Node", "work"];

export interface MacOSServiceConfigOptions {
  platform?: NodeJS.Platform;
  userId?: number;
  homeDirectory?: string;
}

export function macOSNodeServiceConfigPath(homeDirectory: string): string {
  assertAbsoluteHome(homeDirectory);
  return join(normalize(homeDirectory), ...macOSConfigRelativePath);
}

export async function loadMacOSNodeServiceEnvironment(
  options: MacOSServiceConfigOptions = {},
): Promise<NodeEnv> {
  if ((options.platform ?? process.platform) !== "darwin") {
    throw new Error("The macOS Node service configuration requires macOS.");
  }
  const userId = options.userId ?? process.getuid?.();
  if (!Number.isSafeInteger(userId) || userId === undefined || userId <= 0) {
    throw new Error("The macOS Node service requires a non-root user.");
  }
  const homeDirectory = options.homeDirectory ?? process.env.HOME;
  if (homeDirectory === undefined) {
    throw new Error("The macOS Node service configuration is unavailable.");
  }
  assertAbsoluteHome(homeDirectory);

  const config = await readMacOSNodeServiceConfig(
    macOSNodeServiceConfigPath(homeDirectory),
    userId,
  );
  return nodeEnvSchema.parse({
    OPENBOT_NODE_ID: config.nodeId,
    OPENBOT_NODE_SERVER_URL: config.serverUrl,
    OPENBOT_NODE_CREDENTIAL_STORE: "macos-host",
    OPENBOT_NODE_SERVICE_CONTROL: "stdio-v3",
    OPENBOT_NODE_MAX_CONCURRENT_RUNS: String(config.maxConcurrentRuns),
    OPENBOT_NODE_WORK_DIRECTORY: join(normalize(homeDirectory), ...macOSWorkRelativePath),
    OPENBOT_LOG_LEVEL: config.logLevel,
  });
}

async function readMacOSNodeServiceConfig(path: string, userId: number) {
  let handle: FileHandle;
  try {
    const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
    handle = await open(path, constants.O_RDONLY | noFollow);
  } catch {
    throw new Error("The macOS Node service configuration is unavailable.");
  }

  try {
    const before = await handle.stat({ bigint: true });
    assertTrustedConfigMetadata(before, BigInt(userId));
    const bytes = await readBounded(handle);
    const after = await handle.stat({ bigint: true });
    assertTrustedConfigMetadata(after, BigInt(userId));
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    ) {
      bytes.fill(0);
      throw new Error("The macOS Node service configuration changed while it was read.");
    }

    try {
      const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return macOSNodeServiceConfigSchema.parse(JSON.parse(source));
    } catch {
      throw new Error("The macOS Node service configuration is invalid.");
    } finally {
      bytes.fill(0);
    }
  } finally {
    await handle.close();
  }
}

function assertAbsoluteHome(homeDirectory: string): void {
  if (
    homeDirectory.length < 2 ||
    homeDirectory.length > 1_024 ||
    homeDirectory.includes("\0") ||
    !isAbsolute(homeDirectory) ||
    normalize(homeDirectory) !== homeDirectory ||
    homeDirectory === "/"
  ) {
    throw new Error("The macOS Node service home directory is invalid.");
  }
}

function assertTrustedConfigMetadata(metadata: BigIntStats, userId: bigint): void {
  if (
    !metadata.isFile() ||
    metadata.uid !== userId ||
    metadata.nlink !== 1n ||
    (metadata.mode & 0o777n) !== BigInt(requiredConfigMode) ||
    metadata.size < 1n ||
    metadata.size > BigInt(maximumConfigBytes)
  ) {
    throw new Error("The macOS Node service configuration is not private and regular.");
  }
}

async function readBounded(handle: FileHandle): Promise<Buffer> {
  const target = Buffer.alloc(maximumConfigBytes + 1);
  let offset = 0;
  while (offset < target.byteLength) {
    const result = await handle.read(target, offset, target.byteLength - offset, null);
    if (result.bytesRead === 0) break;
    offset += result.bytesRead;
  }
  if (offset > maximumConfigBytes) {
    target.fill(0);
    throw new Error("The macOS Node service configuration exceeds the 16 KiB limit.");
  }
  return target.subarray(0, offset);
}
