import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileNodeCredentialStore } from "./credential-store.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("file Node credential store", () => {
  it("atomically persists and reloads a bounded identity document", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openbot-node-identity-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "private", "identity.json");
    const store = new FileNodeCredentialStore(path);
    const identity = {
      format: "openbot.node-identity/v1" as const,
      nodeId: "linux-node",
      credential: `obn_${"a".repeat(43)}`,
      enrolledAt: "2026-09-04T00:00:00.000Z",
    };

    expect(await store.load("linux-node")).toBeUndefined();
    await store.save(identity);
    expect(await store.load("linux-node")).toEqual(identity);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(identity);
    if (process.platform !== "win32") expect((await stat(path)).mode & 0o777).toBe(0o600);
    await expect(store.load("other-node")).rejects.toThrow("different Node id");
  });
});
