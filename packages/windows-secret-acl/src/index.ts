import { execFile } from "node:child_process";
import { lstat, mkdir, realpath } from "node:fs/promises";
import { dirname, resolve, win32 } from "node:path";
import { promisify } from "node:util";

const executeFile = promisify(execFile);

/** Windows ACL operations for Owner+SYSTEM-only secret directories and files. */
export interface WindowsSecretAcl {
  protectDirectory(path: string, created: boolean): Promise<void>;
  /** Verify-only parent/dedicated directory DACL (Owner+SYSTEM). Never rewrites. */
  verifyDirectory(path: string): Promise<void>;
  protectAndVerifyFile(path: string): Promise<void>;
  verifyFile(path: string): Promise<void>;
}

/**
 * Values travel only through environment variables into a fixed encoded PowerShell script.
 * Allow ACEs are limited to the current user and SYSTEM (S-1-5-18).
 *
 * Owner SID may be supplied via OPENBOT_SECRET_OWNER_SID after the first successful identity
 * probe so later verify/protect scripts skip WindowsIdentity::GetCurrent().
 */
export const WINDOWS_SECRET_DIRECTORY_SCRIPT = `
[Console]::Out.WriteLine('openbot-acl:started')
$ErrorActionPreference = 'Stop'
$path = $env:OPENBOT_SECRET_PATH
$item = [IO.DirectoryInfo]::new($path)
if (!$item.Exists -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unsafe directory' }
[Console]::Out.WriteLine('openbot-acl:identity')
if ($env:OPENBOT_SECRET_OWNER_SID) {
  $owner = [Security.Principal.SecurityIdentifier]::new($env:OPENBOT_SECRET_OWNER_SID)
} else {
  $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
  [Console]::Out.WriteLine("openbot-acl:owner-sid:$($owner.Value)")
}
$system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
if ($env:OPENBOT_SECRET_PROTECT -eq '1') {
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

export const WINDOWS_SECRET_FILE_SCRIPT = `
[Console]::Out.WriteLine('openbot-acl:started')
$ErrorActionPreference = 'Stop'
$path = $env:OPENBOT_SECRET_PATH
$item = [IO.FileInfo]::new($path)
if (!$item.Exists -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unsafe file' }
[Console]::Out.WriteLine('openbot-acl:identity')
if ($env:OPENBOT_SECRET_OWNER_SID) {
  $owner = [Security.Principal.SecurityIdentifier]::new($env:OPENBOT_SECRET_OWNER_SID)
} else {
  $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
  [Console]::Out.WriteLine("openbot-acl:owner-sid:$($owner.Value)")
}
$system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
if ($env:OPENBOT_SECRET_PROTECT -eq '1') {
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

/** @deprecated Alias retained for Node credential-store re-exports. */
export const WINDOWS_CREDENTIAL_DIRECTORY_SCRIPT = WINDOWS_SECRET_DIRECTORY_SCRIPT;
/** @deprecated Alias retained for Node credential-store re-exports. */
export const WINDOWS_CREDENTIAL_FILE_SCRIPT = WINDOWS_SECRET_FILE_SCRIPT;

export interface WindowsSecretAclScriptRequest {
  kind: "directory" | "file";
  path: string;
  forceProtect: boolean;
  ownerSid?: string | undefined;
}

export type WindowsSecretAclScriptRunner = (
  input: WindowsSecretAclScriptRequest,
) => Promise<{ ownerSid?: string }>;

export interface WindowsSecretAclOptions {
  /**
   * When true (default), skip PowerShell for verify* when the path's lstat fingerprint matches a
   * prior successful verify/protect in this process. Protect/rewrite always spawns PowerShell.
   * Does not detect ACL-only changes that leave size/mtime/ino unchanged — callers that need
   * every-read ACL revalidation can set this false (Node credential loads are rare either way).
   */
  cacheVerifiedState?: boolean;
  /** Injectable script runner for tests; defaults to the fixed PowerShell/.NET ACL scripts. */
  scriptRunner?: WindowsSecretAclScriptRunner;
}

interface Fingerprint {
  key: string;
}

export function createWindowsSecretAcl(options: WindowsSecretAclOptions = {}): WindowsSecretAcl {
  const cacheVerifiedState = options.cacheVerifiedState !== false;
  const scriptRunner = options.scriptRunner ?? runWindowsSecretAclScript;
  const verifiedFiles = new Map<string, string>();
  const verifiedDirectories = new Map<string, string>();
  let ownerSid: string | undefined;

  const remember = (
    cache: Map<string, string>,
    path: string,
    fingerprint: Fingerprint | undefined,
  ): void => {
    if (!cacheVerifiedState || fingerprint === undefined) return;
    cache.set(resolve(path), fingerprint.key);
  };

  const cachedHit = async (
    cache: Map<string, string>,
    path: string,
  ): Promise<{ hit: boolean; fingerprint: Fingerprint | undefined }> => {
    if (!cacheVerifiedState) return { hit: false, fingerprint: undefined };
    const fingerprint = await fileFingerprint(path);
    const previous = cache.get(resolve(path));
    return {
      hit: previous !== undefined && previous === fingerprint.key,
      fingerprint,
    };
  };

  return {
    /**
     * Only newly created dedicated directories receive an Owner+SYSTEM DACL rewrite.
     * Existing directories are verified only; unsafe ACLs fail closed without mutation.
     */
    protectDirectory: async (path, created) => {
      const result = await scriptRunner({
        kind: "directory",
        path,
        forceProtect: created,
        ownerSid,
      });
      if (result.ownerSid) ownerSid = result.ownerSid;
      remember(verifiedDirectories, path, await fileFingerprint(path).catch(() => undefined));
    },
    verifyDirectory: async (path) => {
      const { hit, fingerprint } = await cachedHit(verifiedDirectories, path);
      if (hit) return;
      const result = await scriptRunner({
        kind: "directory",
        path,
        forceProtect: false,
        ownerSid,
      });
      if (result.ownerSid) ownerSid = result.ownerSid;
      remember(verifiedDirectories, path, fingerprint ?? (await fileFingerprint(path)));
    },
    protectAndVerifyFile: async (path) => {
      await assertWindowsSecretPathBoundary(path);
      const result = await scriptRunner({
        kind: "file",
        path,
        forceProtect: true,
        ownerSid,
      });
      if (result.ownerSid) ownerSid = result.ownerSid;
      remember(verifiedFiles, path, await fileFingerprint(path).catch(() => undefined));
    },
    verifyFile: async (path) => {
      const { hit, fingerprint } = await cachedHit(verifiedFiles, path);
      if (hit) return;
      const result = await scriptRunner({
        kind: "file",
        path,
        forceProtect: false,
        ownerSid,
      });
      if (result.ownerSid) ownerSid = result.ownerSid;
      remember(verifiedFiles, path, fingerprint ?? (await fileFingerprint(path)));
    },
  };
}

/** Node-compatible name for the default Owner+SYSTEM ACL helper. */
export function createDefaultWindowsCredentialAcl(
  options: WindowsSecretAclOptions = {},
): WindowsSecretAcl {
  return createWindowsSecretAcl(options);
}

/** @deprecated Prefer WindowsSecretAcl; retained for Node credential-store types. */
export type WindowsCredentialAcl = WindowsSecretAcl;

async function runWindowsSecretAclScript(
  input: WindowsSecretAclScriptRequest,
): Promise<{ ownerSid?: string }> {
  if (process.platform !== "win32") {
    throw new Error("Windows secret ACL checks require Windows.");
  }
  const environment = windowsSecretNativeEnvironment();
  const script =
    input.kind === "directory" ? WINDOWS_SECRET_DIRECTORY_SCRIPT : WINDOWS_SECRET_FILE_SCRIPT;
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
        OPENBOT_SECRET_PATH: input.path,
        // Compatibility with older Node script env names if operators inspect the process.
        OPENBOT_CREDENTIAL_PATH: input.path,
        // forceProtect is the only rewrite switch — never rewrite existing shared directories.
        OPENBOT_SECRET_PROTECT: input.forceProtect ? "1" : "0",
        OPENBOT_CREDENTIAL_PROTECT: input.forceProtect ? "1" : "0",
        ...(input.ownerSid === undefined ? {} : { OPENBOT_SECRET_OWNER_SID: input.ownerSid }),
      },
      windowsHide: true,
      shell: false,
      timeout: 15_000,
      maxBuffer: 4096,
    },
  );
  operation.child.stdin?.end();
  try {
    const completed = await operation;
    const output = String(completed.stdout ?? "");
    const sid = [...output.matchAll(/openbot-acl:owner-sid:([S\-0-9]+)/gu)].at(-1)?.[1];
    return sid === undefined ? {} : { ownerSid: sid };
  } catch (error) {
    const output =
      error && typeof error === "object" && "stdout" in error ? String(error.stdout) : "";
    const phase =
      [...output.matchAll(/openbot-acl:(started|identity|protecting|reading)/gu)].at(-1)?.[1] ??
      "launch";
    throw new Error(`Windows secret ${input.kind} ACL verification failed during ${phase}.`);
  }
}

/**
 * Reject secret paths whose leaf or ancestors are Windows reparse points (symlinks/junctions).
 * This reduces parent-path substitution risk; it does not claim all path-attack classes are closed.
 * Parent-directory Write/DeleteChild ACL checks are handled separately via verifyDirectory.
 *
 * Walks the logical path with lstat (so junctions/symlinks are visible). Optional `trustRoot` is
 * realpath-normalized; the walk stops when `realpath(current)` matches that root so macOS `/var`
 * system symlinks above a realpath'd fixture are out of scope.
 *
 * `allowMissingLeaf: true` permits any number of missing trailing segments (first-install nested
 * mkdir), then continues reparse checks on existing ancestors.
 */
export async function assertWindowsSecretPathBoundary(
  targetPath: string,
  options: { allowMissingLeaf?: boolean; trustRoot?: string } = {},
): Promise<void> {
  const resolved = resolve(targetPath);
  const stopAt =
    options.trustRoot !== undefined
      ? (await realpath(options.trustRoot)).toLowerCase()
      : process.platform === "win32"
        ? win32.parse(resolved).root.toLowerCase()
        : undefined;

  let current = resolved;
  for (;;) {
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) {
        throw new Error("Secret path must not use reparse points.");
      }
    } catch (error) {
      if (options.allowMissingLeaf === true && isMissingFile(error)) {
        // First-install may create nested directories; missing trailing segments are OK.
      } else {
        throw error;
      }
    }

    if (await pathMatchesTrustStop(current, stopAt)) break;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

/** Node-compatible alias. */
export async function assertWindowsCredentialPathBoundary(
  targetPath: string,
  options: { allowMissingLeaf?: boolean; trustRoot?: string } = {},
): Promise<void> {
  return assertWindowsSecretPathBoundary(targetPath, options);
}

async function pathMatchesTrustStop(current: string, stopAt: string | undefined): Promise<boolean> {
  if (stopAt === undefined) {
    // POSIX without an explicit trust root: stop after checking the leaf only when the path
    // exists; callers that need ancestor coverage must pass trustRoot (tests use realpath'd roots).
    return true;
  }
  if (current.toLowerCase() === stopAt) return true;
  try {
    return (await realpath(current)).toLowerCase() === stopAt;
  } catch {
    return false;
  }
}

export function windowsSecretNativeEnvironment(
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

/** Node-compatible alias. */
export function windowsCredentialNativeEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  return windowsSecretNativeEnvironment(source);
}

/**
 * Ensure a dedicated secret directory exists. On win32, newly created directories get an
 * Owner+SYSTEM DACL rewrite; existing directories are verified only (never rewritten).
 */
export async function ensureProtectedSecretDirectory(
  directory: string,
  options: {
    platform?: NodeJS.Platform;
    acl?: WindowsSecretAcl;
    trustRoot?: string;
  } = {},
): Promise<void> {
  const platform = options.platform ?? process.platform;
  const acl = options.acl ?? createWindowsSecretAcl();
  let created = false;
  try {
    await lstat(directory);
  } catch (error) {
    if (!isMissingFile(error)) throw error;
    created = true;
  }
  if (platform === "win32") {
    await assertWindowsSecretPathBoundary(directory, {
      allowMissingLeaf: true,
      ...(options.trustRoot === undefined ? {} : { trustRoot: options.trustRoot }),
    });
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (platform === "win32") {
    await acl.protectDirectory(directory, created);
  }
}

/** Verify reparse boundary + parent directory + file DACLs before reading secret bytes on win32. */
export async function verifySecretFileAccess(
  filePath: string,
  options: {
    platform?: NodeJS.Platform;
    acl?: WindowsSecretAcl;
    trustRoot?: string;
  } = {},
): Promise<void> {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32") return;
  const acl = options.acl ?? createWindowsSecretAcl();
  await assertWindowsSecretPathBoundary(filePath, {
    ...(options.trustRoot === undefined ? {} : { trustRoot: options.trustRoot }),
  });
  await acl.verifyDirectory(dirname(filePath));
  await acl.verifyFile(filePath);
}

/** After writing a secret file on win32, rewrite and verify its Owner+SYSTEM DACL. */
export async function protectSecretFile(
  filePath: string,
  options: {
    platform?: NodeJS.Platform;
    acl?: WindowsSecretAcl;
  } = {},
): Promise<void> {
  if ((options.platform ?? process.platform) !== "win32") return;
  const acl = options.acl ?? createWindowsSecretAcl();
  await acl.protectAndVerifyFile(filePath);
}

async function fileFingerprint(path: string): Promise<Fingerprint> {
  const entry = await lstat(path);
  return {
    key: `${entry.dev}:${entry.ino}:${entry.size}:${entry.mtimeMs}:${entry.isDirectory() ? "d" : "f"}`,
  };
}

export function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
