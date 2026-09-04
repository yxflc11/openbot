import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { NodeEnv } from "@openbot/config";
import { type NodeEnrollmentResult, nodeEnrollmentResultSchema } from "@openbot/protocol";
import writeFileAtomic from "write-file-atomic";

const maximumCredentialFileBytes = 4 * 1024;
const secretServiceTimeoutMs = 5_000;
const secretServiceExecutable = "/usr/bin/secret-tool";

export interface NodeCredentialStore {
  load(nodeId: string): Promise<NodeEnrollmentResult | undefined>;
  save(identity: NodeEnrollmentResult): Promise<void>;
}

export interface CredentialHelperRequest {
  executable: string;
  arguments: readonly string[];
  input?: string;
  timeoutMs: number;
  maximumBytes: number;
}

export interface CredentialHelperResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
}

export type CredentialHelper = (
  request: CredentialHelperRequest,
) => Promise<CredentialHelperResult>;

/** Portable fallback store; explicit native adapters can replace it without changing enrollment. */
export class FileNodeCredentialStore implements NodeCredentialStore {
  readonly #path: string;

  constructor(path: string) {
    this.#path = resolve(path);
  }

  async load(nodeId: string): Promise<NodeEnrollmentResult | undefined> {
    try {
      const pathEntry = await lstat(this.#path);
      if (!pathEntry.isFile() || pathEntry.isSymbolicLink()) {
        throw new Error("Node credential path must be a regular file.");
      }
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw error;
    }

    const handle = await open(
      this.#path,
      process.platform === "win32" ? constants.O_RDONLY : constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const file = await handle.stat();
      if (!file.isFile()) throw new Error("Node credential path must be a regular file.");
      if (process.platform !== "win32" && (file.mode & 0o077) !== 0) {
        throw new Error("Node credential file must not be accessible by group or other users.");
      }
      if (file.size > maximumCredentialFileBytes) {
        throw new Error("Node credential file exceeds the 4 KiB limit.");
      }

      return parseIdentity(await handle.readFile("utf8"), nodeId, "file");
    } finally {
      await handle.close();
    }
  }

  async save(identity: NodeEnrollmentResult): Promise<void> {
    const parsed = parseIdentity(JSON.stringify(identity), identity.nodeId, "file");
    await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
    await writeFileAtomic(this.#path, `${JSON.stringify(parsed)}\n`, { mode: 0o600 });
  }
}

interface LinuxSecretServiceOptions {
  platform?: NodeJS.Platform;
  executable?: string;
  helper?: CredentialHelper;
}

/** Explicit Linux login-session store. It never falls back to another keyring or a file. */
export class LinuxSecretServiceNodeCredentialStore implements NodeCredentialStore {
  readonly #executable: string;
  readonly #helper: CredentialHelper;

  constructor(options: LinuxSecretServiceOptions = {}) {
    if ((options.platform ?? process.platform) !== "linux") {
      throw new Error("Linux Secret Service credentials require Linux.");
    }
    this.#executable = options.executable ?? secretServiceExecutable;
    this.#helper = options.helper ?? runCredentialHelper;
  }

  async load(nodeId: string): Promise<NodeEnrollmentResult | undefined> {
    assertNodeId(nodeId);
    const result = await this.#run(["lookup", ...secretServiceAttributes(nodeId)]);
    if (
      result.exitCode === 1 &&
      result.signal === null &&
      result.stdout.length === 0 &&
      result.stderr.length === 0
    ) {
      return undefined;
    }
    try {
      assertSuccessfulSecretServiceResult(result, false);
      return parseIdentity(result.stdout.toString("utf8"), nodeId, "Secret Service");
    } finally {
      result.stdout.fill(0);
      result.stderr.fill(0);
    }
  }

  async save(identity: NodeEnrollmentResult): Promise<void> {
    const parsed = parseIdentity(JSON.stringify(identity), identity.nodeId, "Secret Service");
    const serialized = JSON.stringify(parsed);
    const stored = await this.#run(
      ["store", `--label=OpenBot Node ${parsed.nodeId}`, ...secretServiceAttributes(parsed.nodeId)],
      serialized,
    );
    try {
      assertSuccessfulSecretServiceResult(stored, true);
    } finally {
      stored.stdout.fill(0);
      stored.stderr.fill(0);
    }

    // A successful helper exit is not sufficient evidence that the configured service retained
    // the exact identity. Re-read it before the Node opens its authenticated connection.
    const verified = await this.load(parsed.nodeId);
    if (verified === undefined || !sameIdentity(verified, parsed)) {
      throw new Error("Linux Secret Service did not retain the Node identity.");
    }
  }

  #run(arguments_: readonly string[], input?: string): Promise<CredentialHelperResult> {
    return this.#helper({
      executable: this.#executable,
      arguments: arguments_,
      ...(input === undefined ? {} : { input }),
      timeoutMs: secretServiceTimeoutMs,
      maximumBytes: maximumCredentialFileBytes,
    });
  }
}

/** One-shot identity supplied by the signed macOS Host over its private child pipe. */
export class MacOSHostNodeCredentialStore implements NodeCredentialStore {
  #identity: NodeEnrollmentResult | undefined;

  constructor(identity: NodeEnrollmentResult, options: { platform?: NodeJS.Platform } = {}) {
    if ((options.platform ?? process.platform) !== "darwin") {
      throw new Error("The macOS Host credential channel requires macOS.");
    }
    this.#identity = parseIdentity(JSON.stringify(identity), identity.nodeId, "macOS Host");
  }

  async load(nodeId: string): Promise<NodeEnrollmentResult | undefined> {
    const identity = this.#identity;
    this.#identity = undefined;
    if (identity === undefined) {
      throw new Error("The macOS Host identity was already consumed.");
    }
    return parseIdentity(JSON.stringify(identity), nodeId, "macOS Host");
  }

  async save(): Promise<void> {
    throw new Error("The macOS service cannot enroll or replace its Host-supplied identity.");
  }
}

export function createNodeCredentialStore(env: NodeEnv): NodeCredentialStore {
  if (env.OPENBOT_NODE_CREDENTIAL_STORE === "secret-service") {
    return new LinuxSecretServiceNodeCredentialStore();
  }
  if (env.OPENBOT_NODE_CREDENTIAL_STORE === "macos-host") {
    throw new Error("The macOS Node identity requires its private Host channel.");
  }
  return new FileNodeCredentialStore(
    env.OPENBOT_NODE_CREDENTIAL_PATH ?? join(env.OPENBOT_NODE_WORK_DIRECTORY, "identity.json"),
  );
}

export function runCredentialHelper(
  request: CredentialHelperRequest,
): Promise<CredentialHelperResult> {
  if (
    request.maximumBytes < 1 ||
    request.maximumBytes > maximumCredentialFileBytes ||
    request.timeoutMs < 1 ||
    request.timeoutMs > secretServiceTimeoutMs ||
    (request.input !== undefined && Buffer.byteLength(request.input) > request.maximumBytes)
  ) {
    return Promise.reject(new Error("Linux Secret Service helper request is invalid."));
  }

  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    let child: ChildProcessWithoutNullStreams | undefined;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;

    const reject = (message: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const chunk of [...stdout, ...stderr]) chunk.fill(0);
      child?.kill("SIGKILL");
      rejectPromise(new Error(message));
    };
    const capture = (target: Buffer[], current: "stdout" | "stderr", chunk: Buffer): void => {
      if (settled) return;
      if (current === "stdout") stdoutBytes += chunk.length;
      else stderrBytes += chunk.length;
      if (stdoutBytes > request.maximumBytes || stderrBytes > request.maximumBytes) {
        chunk.fill(0);
        reject("Linux Secret Service helper output exceeded the 4 KiB limit.");
        return;
      }
      target.push(chunk);
    };

    const timer = setTimeout(
      () => reject("Linux Secret Service helper timed out."),
      request.timeoutMs,
    );

    try {
      child = spawn(request.executable, [...request.arguments], {
        shell: false,
        stdio: "pipe",
        windowsHide: true,
      });
    } catch {
      reject("Linux Secret Service helper is unavailable.");
      return;
    }

    child.stdout.on("data", (chunk: Buffer) => capture(stdout, "stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => capture(stderr, "stderr", chunk));
    child.once("error", () => reject("Linux Secret Service helper is unavailable."));
    child.once("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({
        exitCode,
        signal,
        stdout: Buffer.concat(stdout, stdoutBytes),
        stderr: Buffer.concat(stderr, stderrBytes),
      });
    });
    child.stdin.on("error", () => {
      // The final process outcome is authoritative; EPIPE after an early helper exit is expected.
    });
    child.stdin.end(request.input);
  });
}

function assertSuccessfulSecretServiceResult(
  result: CredentialHelperResult,
  requireEmptyStdout: boolean,
): void {
  if (
    result.exitCode !== 0 ||
    result.signal !== null ||
    result.stderr.length !== 0 ||
    (requireEmptyStdout && result.stdout.length !== 0)
  ) {
    throw new Error("Linux Secret Service operation failed.");
  }
}

function assertNodeId(nodeId: string): void {
  if (nodeId.length < 1 || nodeId.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(nodeId)) {
    throw new Error("Node id is invalid.");
  }
}

function secretServiceAttributes(nodeId: string): string[] {
  return [
    "application",
    "openbot",
    "kind",
    "node-identity",
    "format",
    "openbot.node-identity/v1",
    "node",
    nodeId,
  ];
}

function parseIdentity(
  source: string,
  nodeId: string,
  location: "file" | "Secret Service" | "macOS Host",
): NodeEnrollmentResult {
  assertNodeId(nodeId);
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error(`Node credential ${location} is invalid.`);
  }
  const parsed = nodeEnrollmentResultSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Node credential ${location} is invalid.`);
  if (parsed.data.nodeId !== nodeId) {
    throw new Error(`Node credential ${location} belongs to a different Node id.`);
  }
  return parsed.data;
}

function sameIdentity(left: NodeEnrollmentResult, right: NodeEnrollmentResult): boolean {
  return (
    left.format === right.format &&
    left.nodeId === right.nodeId &&
    left.credential === right.credential &&
    left.enrolledAt === right.enrolledAt
  );
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
