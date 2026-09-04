import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileArtifactStorage } from "./artifact-storage.js";

const temporaryRoots: string[] = [];
const onePixelPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("file artifact storage", () => {
  it("writes an immutable PNG under the configured root and can remove it", async () => {
    const root = await mkdtemp(join(tmpdir(), "openbot-artifacts-"));
    temporaryRoots.push(root);
    const storage = new FileArtifactStorage(root);

    const [persisted] = await storage.persist("00000000-0000-4000-8000-000000000001", [
      {
        name: "result.png",
        mediaType: "image/png",
        base64: onePixelPng.toString("base64"),
        metadata: { width: 1, height: 1 },
      },
    ]);

    expect(persisted?.artifact).toMatchObject({
      name: "result.png",
      mediaType: "image/png",
      sizeBytes: onePixelPng.byteLength,
    });
    expect(await storage.read(persisted?.storageKey ?? "")).toEqual(onePixelPng);
    expect((await stat(join(root, persisted?.storageKey ?? ""))).mode & 0o777).toBe(0o600);
    await storage.remove([persisted?.storageKey ?? ""]);
    await expect(storage.read(persisted?.storageKey ?? "")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects non-PNG data and traversal keys", async () => {
    const root = await mkdtemp(join(tmpdir(), "openbot-artifacts-"));
    temporaryRoots.push(root);
    const storage = new FileArtifactStorage(root);

    await expect(
      storage.persist("00000000-0000-4000-8000-000000000001", [
        {
          name: "fake.png",
          mediaType: "image/png",
          base64: Buffer.from("not a png").toString("base64"),
        },
      ]),
    ).rejects.toThrow("Only PNG");
    await expect(storage.read("../../secret")).rejects.toThrow("Invalid artifact storage key");
  });
});
