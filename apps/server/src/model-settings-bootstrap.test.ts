import {
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureProtectedSecretDirectory } from "@openbot/windows-secret-acl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapModelSettings } from "./model-settings-bootstrap.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fixture() {
  // Dedicated leaf is not pre-created so Windows create+protect can run; temp parents stay untouched.
  const root = await mkdtemp(join(tmpdir(), "openbot-model-bootstrap-"));
  directories.push(root);
  const directory = join(root, "model");
  return { directory, root, location: { OPENBOT_MODEL_DIRECTORY: directory } };
}
const fetcher = vi.fn(async () => Response.json({ id: "test-model" }));

describe("Server-owned model configuration bootstrap", () => {
  it("retains one private key and decryptable opt-in configuration across restarts", async () => {
    const { directory, location } = await fixture();
    const service = await bootstrapModelSettings(location, fetcher);
    expect(await service?.summary()).toEqual({ status: "unconfigured", revision: null });
    expect(await service?.agentSettings()).toBeUndefined();
    const key = await readFile(join(directory, "encryption.key"), "utf8");
    expect(key).toMatch(/^[a-f0-9]{64}$/u);
    const saved = await service?.save({
      provider: "openai",
      model: "test-model",
      apiKey: "test-private-123456789",
      revision: null,
      agentEnabled: true,
    });
    const restarted = await bootstrapModelSettings(location, fetcher);
    expect(await restarted?.summary()).toEqual(saved);
    expect((await restarted?.agentSettings())?.agentEnabled).toBe(true);
    expect(await readFile(join(directory, "encryption.key"), "utf8")).toBe(key);
    expect(await readFile(join(directory, "settings.json"), "utf8")).not.toContain("test-private");
    if (process.platform !== "win32") {
      expect((await stat(join(directory, "encryption.key"))).mode & 0o777).toBe(0o600);
    }
  });

  it("preserves the existing explicit-key path and rejects conflicting storage modes", async () => {
    expect(await bootstrapModelSettings({})).toBeUndefined();
    const { directory, location } = await fixture();
    const legacy = {
      OPENBOT_MODEL_SETTINGS_PATH: join(directory, "legacy.json"),
      OPENBOT_MODEL_ENCRYPTION_KEY: "a".repeat(64),
    };
    expect(await (await bootstrapModelSettings(legacy))?.summary()).toEqual({
      status: "unconfigured",
      revision: null,
    });
    await expect(bootstrapModelSettings({ ...legacy, ...location })).rejects.toThrow(
      "one model storage",
    );
    await expect(
      bootstrapModelSettings({ OPENBOT_MODEL_SETTINGS_PATH: legacy.OPENBOT_MODEL_SETTINGS_PATH }),
    ).rejects.toThrow("together");
  });

  it("does not replace a missing key beside retained ciphertext", async () => {
    const { directory, location } = await fixture();
    await ensureProtectedSecretDirectory(directory);
    await writeFile(join(directory, "settings.json"), "retained-private-ciphertext", {
      mode: 0o600,
    });
    await expect(bootstrapModelSettings(location)).rejects.toThrow("Model storage is unavailable");
    await expect(stat(join(directory, "encryption.key"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(directory, "settings.json"), "utf8")).toBe(
      "retained-private-ciphertext",
    );
  });

  it.each(["", "x".repeat(64), "a".repeat(65), "a".repeat(8192)])(
    "fails closed on malformed key material (%#)",
    async (key) => {
      const { directory, location } = await fixture();
      await ensureProtectedSecretDirectory(directory);
      await writeFile(join(directory, "encryption.key"), key, { mode: 0o600 });
      await expect(bootstrapModelSettings(location)).rejects.toThrow(
        "Model storage is unavailable",
      );
      expect(await readFile(join(directory, "encryption.key"), "utf8")).toBe(key);
    },
  );

  it("does not overwrite corrupt model settings on startup", async () => {
    const { directory, location } = await fixture();
    await bootstrapModelSettings(location);
    await writeFile(join(directory, "settings.json"), "broken-ciphertext", { mode: 0o600 });
    await expect(bootstrapModelSettings(location)).rejects.toThrow("Model storage is unavailable");
    expect(await readFile(join(directory, "settings.json"), "utf8")).toBe("broken-ciphertext");
  });

  it.skipIf(process.platform === "win32")(
    "rejects exposed directories, exposed keys, symlinks and hard links",
    async () => {
      const { directory, location } = await fixture();
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await chmod(directory, 0o755);
      await expect(bootstrapModelSettings(location)).rejects.toThrow(
        "Model storage is unavailable",
      );
      await chmod(directory, 0o700);
      await bootstrapModelSettings(location);
      const keyPath = join(directory, "encryption.key");
      await chmod(keyPath, 0o644);
      await expect(bootstrapModelSettings(location)).rejects.toThrow(
        "Model storage is unavailable",
      );
      await chmod(keyPath, 0o600);
      const alias = join(directory, "alias.key");
      await link(keyPath, alias);
      await expect(bootstrapModelSettings(location)).rejects.toThrow(
        "Model storage is unavailable",
      );
      await rm(keyPath);
      await symlink(alias, keyPath);
      await expect(bootstrapModelSettings(location)).rejects.toThrow(
        "Model storage is unavailable",
      );
      const linked = join(directory, "linked-directory");
      await symlink(directory, linked);
      await expect(bootstrapModelSettings({ OPENBOT_MODEL_DIRECTORY: linked })).rejects.toThrow(
        "Model storage is unavailable",
      );
    },
  );
});
