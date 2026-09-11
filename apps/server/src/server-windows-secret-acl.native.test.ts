import { execFile } from "node:child_process";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, win32 } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapModelSettings } from "./model-settings-bootstrap.js";
import { ModelSettingsService } from "./model-settings.js";
import { FilePluginStore } from "./plugin-store.js";

const executeFile = promisify(execFile);
const directories: string[] = [];
/** Per-spawn PowerShell deadline, matching production `executeFile` in `@openbot/windows-secret-acl`. */
const POWERSHELL_SPAWN_TIMEOUT_MS = 15_000;
/**
 * Bounded native-test harness deadline (not unbounded). Heaviest empirical case is model ACL-only:
 * ≤9 PowerShell spawns × 15s production cap = 135s, plus 45s runner/contention margin → 180s.
 * See docs/research/windows-native-acl-test-budget.md
 */
const NATIVE_TIMEOUT_MS = 180_000;

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function realpathTempRoot(prefix: string): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  directories.push(root);
  return root;
}

/**
 * Broaden a secret path DACL for native negative tests.
 * Matches production spawn hygiene: inbox powershell.exe, shell:false, stdin closed, 15s cap.
 * Uses fixed .NET FileSecurity/DirectorySecurity + GetAccessControl/SetAccessControl — not
 * Get-Acl/Set-Acl cmdlets (Microsoft.PowerShell.Security module auto-load can hang under CI).
 */
async function broadenAcl(targetPath: string, kind: "file" | "directory"): Promise<void> {
  const broaden =
    kind === "file"
      ? `
$ErrorActionPreference = 'Stop'
$path = $env:OPENBOT_TEST_PATH
$item = Get-Item -LiteralPath $path
$acl = $item.GetAccessControl()
$acl.SetAccessRuleProtection($true, $false)
foreach ($rule in @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))) {
  [void]$acl.RemoveAccessRule($rule)
}
$everyone = [Security.Principal.SecurityIdentifier]::new('S-1-1-0')
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($everyone, 'FullControl', 'None', 'None', 'Allow'))
$item.SetAccessControl($acl)
`
      : `
$ErrorActionPreference = 'Stop'
$path = $env:OPENBOT_TEST_PATH
$item = Get-Item -LiteralPath $path
$acl = $item.GetAccessControl()
$acl.SetAccessRuleProtection($true, $false)
foreach ($rule in @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))) {
  [void]$acl.RemoveAccessRule($rule)
}
$everyone = [Security.Principal.SecurityIdentifier]::new('S-1-1-0')
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($everyone, 'Modify', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
$item.SetAccessControl($acl)
`;
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT;
  if (!systemRoot) throw new Error("Windows SystemRoot is required for broadenAcl.");
  const powershell = win32.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const operation = executeFile(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(broaden, "utf16le").toString("base64"),
    ],
    {
      env: {
        SystemRoot: systemRoot,
        WINDIR: systemRoot,
        OPENBOT_TEST_PATH: targetPath,
      },
      windowsHide: true,
      shell: false,
      timeout: POWERSHELL_SPAWN_TIMEOUT_MS,
      maxBuffer: 4096,
    },
  );
  // Same as production runWindowsSecretAclScript: close stdin so PowerShell does not wait on pipe EOF.
  operation.child.stdin?.end();
  await operation;
}

const fetcher = vi.fn(async () => Response.json({ id: "test-model" }));
const modelInput = {
  provider: "openai" as const,
  model: "test-model",
  apiKey: "test-key-private-123456789",
  revision: null as string | null,
  agentEnabled: false,
};

describe.skipIf(process.platform !== "win32")("Server Windows secret ACL (native)", () => {
  it(
    "model settings: ACL-only file DACL change after read fails the next read",
    async () => {
      const root = await realpathTempRoot("openbot-server-model-acl-");
      const path = join(root, "private", "model.json");
      const service = new ModelSettingsService(path, "a".repeat(64), fetcher, {
        windowsTrustRoot: root,
      });
      const saved = await service.save(modelInput);
      expect(await service.summary()).toEqual(saved);
      // Content unchanged — only broaden the secret file DACL.
      await broadenAcl(path, "file");
      await expect(service.summary()).rejects.toMatchObject({ code: "storage_unavailable" });
    },
    NATIVE_TIMEOUT_MS,
  );

  it(
    "model settings: retained read works after a new service instance when ACL is OK",
    async () => {
      const root = await realpathTempRoot("openbot-server-model-retain-");
      const path = join(root, "private", "model.json");
      const first = new ModelSettingsService(path, "a".repeat(64), fetcher, {
        windowsTrustRoot: root,
      });
      const saved = await first.save(modelInput);
      const restarted = new ModelSettingsService(path, "a".repeat(64), fetcher, {
        windowsTrustRoot: root,
      });
      expect(await restarted.summary()).toEqual(saved);
    },
    NATIVE_TIMEOUT_MS,
  );

  it(
    "bootstrap key: ACL-only change after read fails the next bootstrap",
    async () => {
      const root = await realpathTempRoot("openbot-server-bootstrap-acl-");
      const directory = join(root, "model");
      const first = await bootstrapModelSettings(
        { OPENBOT_MODEL_DIRECTORY: directory },
        { fetcher, windowsTrustRoot: root },
      );
      expect(await first?.summary()).toEqual({ status: "unconfigured", revision: null });
      const keyPath = join(directory, "encryption.key");
      const key = await readFile(keyPath, "utf8");
      expect(key).toMatch(/^[a-f0-9]{64}$/u);
      await broadenAcl(keyPath, "file");
      await expect(
        bootstrapModelSettings(
          { OPENBOT_MODEL_DIRECTORY: directory },
          { fetcher, windowsTrustRoot: root },
        ),
      ).rejects.toThrow("Model storage is unavailable");
      expect(await readFile(keyPath, "utf8")).toBe(key);
    },
    NATIVE_TIMEOUT_MS,
  );

  it(
    "bootstrap: retained read works after restart when ACL is OK",
    async () => {
      const root = await realpathTempRoot("openbot-server-bootstrap-retain-");
      const directory = join(root, "model");
      const first = await bootstrapModelSettings(
        { OPENBOT_MODEL_DIRECTORY: directory },
        { fetcher, windowsTrustRoot: root },
      );
      const saved = await first?.save({ ...modelInput, agentEnabled: true });
      const restarted = await bootstrapModelSettings(
        { OPENBOT_MODEL_DIRECTORY: directory },
        { fetcher, windowsTrustRoot: root },
      );
      expect(await restarted?.summary()).toEqual(saved);
    },
    NATIVE_TIMEOUT_MS,
  );

  it(
    "plugin store file: ACL-only DACL change after read fails the next read",
    async () => {
      const root = await realpathTempRoot("openbot-server-plugin-acl-");
      const path = join(root, "private", "plugins.json");
      const store = new FilePluginStore(path, { windowsTrustRoot: root });
      await store.transaction((state) => {
        state.plugins.push({
          id: "11111111-1111-4111-8111-111111111111",
          name: "fixture",
          endpoint: "https://127.0.0.1:9",
          digest: "a".repeat(64),
          revision: "22222222-2222-4222-8222-222222222222",
          enabled: true,
          createdAt: "2026-09-11T00:00:00.000Z",
          tools: [],
          grants: [],
          token: "plugin-token-secret-value",
        });
      });
      expect((await store.read()).plugins).toHaveLength(1);
      await broadenAcl(path, "file");
      await expect(store.read()).rejects.toMatchObject({ code: "unavailable" });
    },
    NATIVE_TIMEOUT_MS,
  );

  it(
    "plugin .key: ACL-only DACL change after persist fails first read on a new store",
    async () => {
      const root = await realpathTempRoot("openbot-server-plugin-key-acl-");
      const path = join(root, "private", "plugins.json");
      const keyPath = `${path}.key`;
      const first = new FilePluginStore(path, { windowsTrustRoot: root });
      await first.transaction((state) => {
        state.plugins.push({
          id: "11111111-1111-4111-8111-111111111111",
          name: "fixture",
          endpoint: "https://127.0.0.1:9",
          digest: "a".repeat(64),
          revision: "22222222-2222-4222-8222-222222222222",
          enabled: true,
          createdAt: "2026-09-11T00:00:00.000Z",
          tools: [],
          grants: [],
          token: "plugin-token-secret-value",
        });
      });
      expect((await first.read()).plugins).toHaveLength(1);
      const keyBytes = await readFile(keyPath);
      expect(keyBytes.byteLength).toBe(32);
      // Only the encryption key file DACL changes — store file ACL stays Owner+SYSTEM.
      await broadenAcl(keyPath, "file");
      const restarted = new FilePluginStore(path, { windowsTrustRoot: root });
      await expect(restarted.read()).rejects.toMatchObject({ code: "unavailable" });
      expect(Buffer.compare(await readFile(keyPath), keyBytes)).toBe(0);
    },
    NATIVE_TIMEOUT_MS,
  );

  it(
    "plugin store: parent directory ACL-only change fails the next read",
    async () => {
      const root = await realpathTempRoot("openbot-server-plugin-dir-acl-");
      const path = join(root, "private", "plugins.json");
      const store = new FilePluginStore(path, { windowsTrustRoot: root });
      await store.transaction((state) => {
        state.plugins.push({
          id: "11111111-1111-4111-8111-111111111111",
          name: "fixture",
          endpoint: "https://127.0.0.1:9",
          digest: "a".repeat(64),
          revision: "22222222-2222-4222-8222-222222222222",
          enabled: true,
          createdAt: "2026-09-11T00:00:00.000Z",
          tools: [],
          grants: [],
        });
      });
      expect((await store.read()).plugins).toHaveLength(1);
      await broadenAcl(join(root, "private"), "directory");
      await expect(store.read()).rejects.toMatchObject({ code: "unavailable" });
    },
    NATIVE_TIMEOUT_MS,
  );

  it(
    "plugin store: retained read works after a new store instance when ACL is OK",
    async () => {
      const root = await realpathTempRoot("openbot-server-plugin-retain-");
      const path = join(root, "private", "plugins.json");
      const first = new FilePluginStore(path, { windowsTrustRoot: root });
      await first.transaction((state) => {
        state.plugins.push({
          id: "11111111-1111-4111-8111-111111111111",
          name: "fixture",
          endpoint: "https://127.0.0.1:9",
          digest: "a".repeat(64),
          revision: "22222222-2222-4222-8222-222222222222",
          enabled: true,
          createdAt: "2026-09-11T00:00:00.000Z",
          tools: [],
          grants: [],
          token: "plugin-token-secret-value",
        });
      });
      const restarted = new FilePluginStore(path, { windowsTrustRoot: root });
      const state = await restarted.read();
      expect(state.plugins).toHaveLength(1);
      expect(state.plugins[0]?.token).toBe("plugin-token-secret-value");
    },
    NATIVE_TIMEOUT_MS,
  );
});
