import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertWindowsSecretPathBoundary,
  createWindowsSecretAcl,
  ensureProtectedSecretDirectory,
  protectSecretFile,
  verifySecretFileAccess,
  type WindowsSecretAcl,
  type WindowsSecretAclScriptRequest,
  windowsSecretNativeEnvironment,
} from "./index.js";

const temporaryDirectories: string[] = [];

async function realpathTempRoot(): Promise<string> {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "openbot-secret-acl-")));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("assertWindowsSecretPathBoundary", () => {
  it("allowMissingLeaf accepts first-install multi-level missing segments under a trust root", async () => {
    const root = await realpathTempRoot();
    const nested = join(root, "a", "b", "c");
    await expect(
      assertWindowsSecretPathBoundary(nested, { allowMissingLeaf: true, trustRoot: root }),
    ).resolves.toBeUndefined();
    await expect(assertWindowsSecretPathBoundary(nested, { trustRoot: root })).rejects.toThrow();
  });

  it.skipIf(process.platform === "win32")(
    "rejects a symlink ancestor within a realpath trust root",
    async () => {
      const root = await realpathTempRoot();
      const realDirectory = join(root, "real");
      const linkDirectory = join(root, "link");
      await mkdir(realDirectory);
      await symlink(realDirectory, linkDirectory);
      await writeFile(join(realDirectory, "secret.json"), "{}\n", { mode: 0o600 });
      await expect(
        assertWindowsSecretPathBoundary(join(linkDirectory, "secret.json"), { trustRoot: root }),
      ).rejects.toThrow("reparse points");
    },
  );
});

describe("createWindowsSecretAcl PowerShell cost cache", () => {
  it("skips scriptRunner on repeated verify* when fingerprint is unchanged", async () => {
    const root = await realpathTempRoot();
    const directory = join(root, "private");
    await mkdir(directory, { mode: 0o700 });
    const path = join(directory, "secret.json");
    await writeFile(path, "secret\n", { mode: 0o600 });

    const runs: WindowsSecretAclScriptRequest[] = [];
    const acl = createWindowsSecretAcl({
      cacheVerifiedState: true,
      scriptRunner: async (request) => {
        runs.push(request);
        return { ownerSid: "S-1-5-21-1" };
      },
    });

    await acl.verifyDirectory(directory);
    await acl.verifyFile(path);
    await acl.verifyDirectory(directory);
    await acl.verifyFile(path);
    expect(runs).toHaveLength(2);
    expect(runs.map((entry) => entry.kind)).toEqual(["directory", "file"]);
    expect(runs[0]?.forceProtect).toBe(false);
    expect(runs[1]?.ownerSid).toBe("S-1-5-21-1");

    await writeFile(path, "secret-changed\n", { mode: 0o600 });
    await acl.verifyFile(path);
    expect(runs).toHaveLength(3);
    expect(runs[2]?.kind).toBe("file");
  });

  it("always runs scriptRunner for protect* and reuses cached owner SID", async () => {
    const root = await realpathTempRoot();
    const directory = join(root, "private");
    await mkdir(directory, { mode: 0o700 });
    const path = join(directory, "secret.json");
    await writeFile(path, "secret\n", { mode: 0o600 });

    const runs: WindowsSecretAclScriptRequest[] = [];
    const acl = createWindowsSecretAcl({
      scriptRunner: async (request) => {
        runs.push(request);
        return request.ownerSid === undefined ? { ownerSid: "S-1-5-21-9" } : {};
      },
    });

    await acl.protectDirectory(directory, true);
    await acl.protectAndVerifyFile(path);
    expect(runs).toHaveLength(2);
    expect(runs[0]?.forceProtect).toBe(true);
    expect(runs[0]?.ownerSid).toBeUndefined();
    expect(runs[1]?.ownerSid).toBe("S-1-5-21-9");
    expect(runs[1]?.forceProtect).toBe(true);
  });

  it("cacheVerifiedState false re-runs verify every time", async () => {
    const root = await realpathTempRoot();
    const path = join(root, "secret.json");
    await writeFile(path, "secret\n", { mode: 0o600 });
    const runs: string[] = [];
    const acl = createWindowsSecretAcl({
      cacheVerifiedState: false,
      scriptRunner: async () => {
        runs.push("verify");
        return {};
      },
    });
    await acl.verifyFile(path);
    await acl.verifyFile(path);
    expect(runs).toHaveLength(2);
  });
});

describe("ensureProtectedSecretDirectory / protectSecretFile", () => {
  it("creates nested directories and only marks newly created dirs for protect", async () => {
    const root = await realpathTempRoot();
    const dedicated = join(root, "private");
    const calls: string[] = [];
    const acl: WindowsSecretAcl = {
      async protectDirectory(_path, created) {
        calls.push(created ? "new" : "existing");
      },
      verifyDirectory: async () => {},
      protectAndVerifyFile: async () => {
        calls.push("file");
      },
      verifyFile: async () => {},
    };

    await ensureProtectedSecretDirectory(dedicated, {
      platform: "win32",
      acl,
      trustRoot: root,
    });
    await writeFile(join(dedicated, "secret.json"), "x\n", { mode: 0o600 });
    await protectSecretFile(join(dedicated, "secret.json"), { platform: "win32", acl });
    expect(calls).toEqual(["new", "file"]);

    calls.length = 0;
    await ensureProtectedSecretDirectory(dedicated, {
      platform: "win32",
      acl,
      trustRoot: root,
    });
    expect(calls).toEqual(["existing"]);
  });

  it("on POSIX ensureProtectedSecretDirectory only mkdirs without ACL calls", async () => {
    const root = await realpathTempRoot();
    const dedicated = join(root, "private");
    const acl: WindowsSecretAcl = {
      protectDirectory: async () => {
        throw new Error("should not run");
      },
      verifyDirectory: async () => {
        throw new Error("should not run");
      },
      protectAndVerifyFile: async () => {
        throw new Error("should not run");
      },
      verifyFile: async () => {
        throw new Error("should not run");
      },
    };
    await ensureProtectedSecretDirectory(dedicated, { platform: "linux", acl });
    await writeFile(join(dedicated, "secret.json"), "x\n", { mode: 0o600 });
  });

  it("verifySecretFileAccess is a no-op on non-Windows platforms", async () => {
    const root = await realpathTempRoot();
    const path = join(root, "secret.json");
    await writeFile(path, "x\n", { mode: 0o600 });
    await verifySecretFileAccess(path, {
      platform: "linux",
      acl: {
        protectDirectory: async () => {
          throw new Error("no");
        },
        verifyDirectory: async () => {
          throw new Error("no");
        },
        protectAndVerifyFile: async () => {
          throw new Error("no");
        },
        verifyFile: async () => {
          throw new Error("no");
        },
      },
    });
  });
});

describe("windowsSecretNativeEnvironment", () => {
  it("requires a well-formed SystemRoot and copies safe temp variables", () => {
    expect(() => windowsSecretNativeEnvironment({} as NodeJS.ProcessEnv)).toThrow(
      "Windows system directory",
    );
    const environment = windowsSecretNativeEnvironment({
      SystemRoot: "C:\\Windows",
      TEMP: "C:\\Temp",
      BAD: "x\ny",
    } as NodeJS.ProcessEnv);
    expect(environment.SystemRoot).toBe("C:\\Windows");
    expect(environment.TEMP).toBe("C:\\Temp");
    expect(environment.PATH).toMatch(/System32$/u);
  });
});
