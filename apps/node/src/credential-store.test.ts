import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileNodeCredentialStore } from "./credential-store.js";

const temporaryDirectories: string[] = [];
const identity = {
  format: "openbot.node-identity/v1" as const,
  nodeId: "linux-node",
  credential: `obn_${"a".repeat(43)}`,
  enrolledAt: "2026-09-04T00:00:00.000Z",
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("file Node credential store", () => {
  it("atomically persists and reloads a bounded identity document", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openbot-node-identity-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "private", "identity.json");
    const store = new FileNodeCredentialStore(path);

    expect(await store.load("linux-node")).toBeUndefined();
    await store.save(identity);
    expect(await store.load("linux-node")).toEqual(identity);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(identity);
    if (process.platform !== "win32") expect((await stat(path)).mode & 0o777).toBe(0o600);
    await expect(store.load("other-node")).rejects.toThrow("different Node id");
  });

  it.skipIf(process.platform === "win32")(
    "refuses a credential that became accessible to other POSIX users",
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "openbot-node-identity-"));
      temporaryDirectories.push(directory);
      const path = join(directory, "identity.json");
      const store = new FileNodeCredentialStore(path);

      await store.save(identity);
      await chmod(path, 0o644);

      await expect(store.load(identity.nodeId)).rejects.toThrow("group or other users");
    },
  );

  it.skipIf(process.platform === "win32")("refuses a symbolic-link credential path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openbot-node-identity-"));
    temporaryDirectories.push(directory);
    const target = join(directory, "target.json");
    const path = join(directory, "identity.json");
    await writeFile(target, `${JSON.stringify(identity)}\n`, { mode: 0o600 });
    await symlink(target, path);

    await expect(new FileNodeCredentialStore(path).load(identity.nodeId)).rejects.toThrow(
      "regular file",
    );
  });

  it("refuses directories, oversized content, and malformed packages", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openbot-node-identity-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "identity.json");
    const store = new FileNodeCredentialStore(path);

    await mkdir(path);
    await expect(store.load(identity.nodeId)).rejects.toThrow("regular file");
    await rm(path, { recursive: true });

    await writeFile(path, "x".repeat(4 * 1024 + 1), { mode: 0o600 });
    await expect(store.load(identity.nodeId)).rejects.toThrow("4 KiB limit");

    await writeFile(path, "{}\n", { mode: 0o600 });
    await expect(store.load(identity.nodeId)).rejects.toThrow("invalid");
  });
});
