import { type ChildProcessWithoutNullStreams, execFile, spawn } from "node:child_process";
import { constants } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import { dirname, join, resolve, win32 } from "node:path";
import { promisify } from "node:util";
import type { NodeEnv } from "@openbot/config";
import { type NodeEnrollmentResult, nodeEnrollmentResultSchema } from "@openbot/protocol";
import writeFileAtomic from "write-file-atomic";

const executeFile = promisify(execFile);

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
  readonly #platform: NodeJS.Platform;
  readonly #windowsAcl: WindowsCredentialAcl;

  constructor(
    path: string,
    options: {
      platform?: NodeJS.Platform;
      windowsAcl?: WindowsCredentialAcl;
    } = {},
  ) {
    this.#path = resolve(path);
    this.#platform = options.platform ?? process.platform;
    this.#windowsAcl = options.windowsAcl ?? createDefaultWindowsCredentialAcl();
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

    if (this.#platform === "win32") {
      await assertWindowsCredentialPathBoundary(this.#path);
      await this.#windowsAcl.verifyFile(this.#path);
    }

    const handle = await open(
      this.#path,
      this.#platform === "win32" ? constants.O_RDONLY : constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const file = await handle.stat();
      if (!file.isFile()) throw new Error("Node credential path must be a regular file.");
      if (this.#platform !== "win32" && (file.mode & 0o077) !== 0) {
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
    const directory = dirname(this.#path);
    let createdDirectory = false;
    try {
      await lstat(directory);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
      createdDirectory = true;
    }

    if (this.#platform === "win32") {
      await assertWindowsCredentialPathBoundary(directory, { allowMissingLeaf: true });
    }
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (this.#platform === "win32") {
      // Rewrite ACLs only for directories we just created — never mutate operator-shared parents.
      await this.#windowsAcl.protectDirectory(directory, createdDirectory);
    }

    await writeFileAtomic(this.#path, `${JSON.stringify(parsed)}\n`, { mode: 0o600 });
    if (this.#platform === "win32") {
      await this.#windowsAcl.protectAndVerifyFile(this.#path);
    }
  }
}

/** Windows ACL operations for the file-backed Node credential adapter. */
export interface WindowsCredentialAcl {
  protectDirectory(path: string, created: boolean): Promise<void>;
  protectAndVerifyFile(path: string): Promise<void>;
  verifyFile(path: string): Promise<void>;
}

/**
 * Values travel only through environment variables into a fixed encoded PowerShell script.
 * Allow ACEs are limited to the current user and SYSTEM (S-1-5-18).
 */
export const WINDOWS_CREDENTIAL_DIRECTORY_SCRIPT = `
[Console]::Out.WriteLine('openbot-acl:started')
$ErrorActionPreference = 'Stop'
$path = $env:OPENBOT_CREDENTIAL_PATH
$item = [IO.DirectoryInfo]::new($path)
if (!$item.Exists -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unsafe directory' }
[Console]::Out.WriteLine('openbot-acl:identity')
$owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
$system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
if ($env:OPENBOT_CREDENTIAL_PROTECT -eq '1') {
  [Console]::Out.WriteLine('openbot-acl:protecting')
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetOwner($owner)
  $acl.SetAccessRuleProtection($true, $false)
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($owner, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($system, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
  $item.SetAccessControl($acl)
}
[Console]::Out.WriteLine('openbot-acl:reading')
$acl = $item.GetAccessControl()
if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $owner.Value) { throw 'Unexpected owner' }
$allowed = @{}
foreach ($rule in @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))) {
  if ($rule.AccessControlType -ne 'Allow') { continue }
  $sid = $rule.IdentityReference.Value
  if ($sid -ne $owner.Value -and $sid -ne $system.Value) { throw 'Unexpected directory access' }
  if (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl) { $allowed[$sid] = $true }
}
if (-not $allowed.ContainsKey($owner.Value)) { throw 'Missing owner access' }
if (-not $allowed.ContainsKey($system.Value)) { throw 'Missing system access' }
`;

export const WINDOWS_CREDENTIAL_FILE_SCRIPT = `
[Console]::Out.WriteLine('openbot-acl:started')
$ErrorActionPreference = 'Stop'
$path = $env:OPENBOT_CREDENTIAL_PATH
$item = [IO.FileInfo]::new($path)
if (!$item.Exists -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unsafe file' }
[Console]::Out.WriteLine('openbot-acl:identity')
$owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
$system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
if ($env:OPENBOT_CREDENTIAL_PROTECT -eq '1') {
  [Console]::Out.WriteLine('openbot-acl:protecting')
  $acl = [Security.AccessControl.FileSecurity]::new()
  $acl.SetOwner($owner)
  $acl.SetAccessRuleProtection($true, $false)
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($owner, 'FullControl', 'None', 'None', 'Allow'))
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($system, 'FullControl', 'None', 'None', 'Allow'))
  $item.SetAccessControl($acl)
}
[Console]::Out.WriteLine('openbot-acl:reading')
$acl = $item.GetAccessControl()
if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $owner.Value) { throw 'Unexpected owner' }
$allowed = @{}
foreach ($rule in @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))) {
  if ($rule.AccessControlType -ne 'Allow') { continue }
  $sid = $rule.IdentityReference.Value
  if ($sid -ne $owner.Value -and $sid -ne $system.Value) { throw 'Unexpected file access' }
  if (($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl) { $allowed[$sid] = $true }
}
if (-not $allowed.ContainsKey($owner.Value)) { throw 'Missing owner access' }
if (-not $allowed.ContainsKey($system.Value)) { throw 'Missing system access' }
`;

export function createDefaultWindowsCredentialAcl(): WindowsCredentialAcl {
  return {
    /**
     * Only newly created dedicated directories receive an Owner+SYSTEM DACL rewrite.
     * Existing directories are verified only; unsafe ACLs fail closed without mutation.
     */
    protectDirectory: (path, created) =>
      runWindowsCredentialAclScript({
        kind: "directory",
        path,
        forceProtect: created,
      }),
    protectAndVerifyFile: async (path) => {
      await assertWindowsCredentialPathBoundary(path);
      await runWindowsCredentialAclScript({ kind: "file", path, forceProtect: true });
    },
    verifyFile: async (path) => {
      await assertWindowsCredentialPathBoundary(path);
      await runWindowsCredentialAclScript({ kind: "file", path, forceProtect: false });
    },
  };
}

async function runWindowsCredentialAclScript(input: {
  kind: "directory" | "file";
  path: string;
  forceProtect: boolean;
}): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Windows credential ACL checks require Windows.");
  }
  const environment = windowsCredentialNativeEnvironment();
  const script =
    input.kind === "directory"
      ? WINDOWS_CREDENTIAL_DIRECTORY_SCRIPT
      : WINDOWS_CREDENTIAL_FILE_SCRIPT;
  const operation = executeFile(
    win32.join(
      environment.SystemRoot ?? "",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    ),
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(script, "utf16le").toString("base64"),
    ],
    {
      env: {
        ...environment,
        OPENBOT_CREDENTIAL_PATH: input.path,
        // forceProtect is the only rewrite switch — never rewrite existing shared directories.
        OPENBOT_CREDENTIAL_PROTECT: input.forceProtect ? "1" : "0",
      },
      windowsHide: true,
      shell: false,
      timeout: 15_000,
      maxBuffer: 4096,
    },
  );
  operation.child.stdin?.end();
  try {
    await operation;
  } catch (error) {
    const output =
      error && typeof error === "object" && "stdout" in error ? String(error.stdout) : "";
    const phase =
      [...output.matchAll(/openbot-acl:(started|identity|protecting|reading)/gu)].at(-1)?.[1] ??
      "launch";
    throw new Error(`Windows credential ${input.kind} ACL verification failed during ${phase}.`);
  }
}

/**
 * Reject credential paths whose leaf or ancestors are Windows reparse points (symlinks/junctions).
 * This reduces parent-path substitution risk; it does not claim all path-attack classes are closed.
 */
export async function assertWindowsCredentialPathBoundary(
  targetPath: string,
  options: { allowMissingLeaf?: boolean } = {},
): Promise<void> {
  let current = resolve(targetPath);
  const root = win32.parse(current).root.toLowerCase();
  let isLeaf = true;
  for (;;) {
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) {
        throw new Error("Node credential path must not use reparse points.");
      }
    } catch (error) {
      if (isLeaf && options.allowMissingLeaf === true && isMissingFile(error)) {
        // Continue walking parents that do exist.
      } else {
        throw error;
      }
    }
    if (current.toLowerCase() === root) break;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
    isLeaf = false;
  }
}

export function windowsCredentialNativeEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const systemRoot = source.SystemRoot ?? source.SYSTEMROOT;
  if (!systemRoot || !/^[A-Za-z]:\\[^\0\r\n]*$/u.test(systemRoot)) {
    throw new Error("Windows system directory is unavailable.");
  }
  const environment: Record<string, string> = {
    SystemRoot: systemRoot,
    WINDIR: systemRoot,
    COMSPEC: win32.join(systemRoot, "System32", "cmd.exe"),
    PATH: win32.join(systemRoot, "System32"),
    LANG: "C",
    LC_ALL: "C",
  };
  for (const name of ["TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA"]) {
    const value = source[name];
    if (value && !/[\0\r\n]/u.test(value)) environment[name] = value;
  }
  return environment;
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
