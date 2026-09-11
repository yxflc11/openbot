import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WindowsSecretAcl } from "@openbot/windows-secret-acl";
import { afterEach, describe, expect, it } from "vitest";
import { FilePluginStore } from "./plugin-store.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("FilePluginStore Windows ACL", () => {
  it("protects newly created store directories and key/files through the injected helper", async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "openbot-plugin-acl-")));
    directories.push(root);
    const path = join(root, "private", "plugins.json");
    const calls: string[] = [];
    const windowsAcl: WindowsSecretAcl = {
      async protectDirectory(_target, created) {
        calls.push(`dir:${created ? "new" : "existing"}`);
      },
      async verifyDirectory() {
        calls.push("dir-verify");
      },
      async protectAndVerifyFile(target) {
        calls.push(target.endsWith(".key") ? "key-protect" : "file-protect");
      },
      async verifyFile(target) {
        calls.push(target.endsWith(".key") ? "key-verify" : "file-verify");
      },
    };
    const store = new FilePluginStore(path, {
      platform: "win32",
      windowsAcl,
      windowsTrustRoot: root,
    });

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

    expect(calls.filter((entry) => entry.startsWith("dir:")).length).toBeGreaterThanOrEqual(1);
    expect(calls).toContain("key-protect");
    expect(calls).toContain("file-protect");
    expect(await readFile(path, "utf8")).toContain("version");

    calls.length = 0;
    const state = await store.read();
    expect(state.plugins).toHaveLength(1);
    // Key bytes stay process-cached after first load; file DACL is re-checked on each read.
    expect(calls).toContain("file-verify");
    expect(calls).not.toContain("key-protect");
  });

  it("refuses read when the file ACL helper fails closed", async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "openbot-plugin-acl-")));
    directories.push(root);
    const directory = join(root, "private");
    await mkdir(directory, { mode: 0o700 });
    const path = join(directory, "plugins.json");
    await writeFile(path, "{}", { mode: 0o600 });
    await writeFile(`${path}.key`, Buffer.alloc(32), { mode: 0o600 });
    const store = new FilePluginStore(path, {
      platform: "win32",
      windowsTrustRoot: root,
      windowsAcl: {
        protectDirectory: async () => {},
        verifyDirectory: async () => {},
        protectAndVerifyFile: async () => {},
        verifyFile: async () => {
          throw new Error("Windows secret file ACL verification failed during reading.");
        },
      },
    });
    await expect(store.read()).rejects.toMatchObject({ code: "unavailable" });
  });
});
