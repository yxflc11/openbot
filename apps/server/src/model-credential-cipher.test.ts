import { randomBytes } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ModelCredentialCipher } from "./model-credential-cipher.js";

const context = { id: "connection-one", presetId: "deepseek", baseUrl: "https://api.deepseek.com" };
const apiKey = "test-api-key-must-not-appear-in-errors";
const directories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "openbot-model-key-test-"));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("model credential authenticated encryption", () => {
  it("uses fresh nonces and authenticates the ciphertext and every connection binding", () => {
    const cipher = ModelCredentialCipher.fromKey(randomBytes(32));
    const first = cipher.encrypt(apiKey, context);
    const second = cipher.encrypt(apiKey, context);
    expect(first).not.toEqual(second);
    expect(first).not.toContain(apiKey);
    expect(cipher.decrypt(first, context)).toBe(apiKey);
    for (const otherContext of [
      { ...context, id: "connection-two" },
      { ...context, presetId: "openai" },
      { ...context, baseUrl: "https://api.openai.com/v1" },
    ]) {
      expect(() => cipher.decrypt(first, otherContext)).toThrow(
        "could not be encrypted or authenticated",
      );
    }
    for (const part of [1, 2, 3]) {
      const pieces = first.split(".");
      const original = pieces[part];
      if (original === undefined) throw new Error("Encrypted envelope part is missing.");
      pieces[part] = `${original[0] === "A" ? "B" : "A"}${original.slice(1)}`;
      expect(() => cipher.decrypt(pieces.join("."), context)).toThrow(
        "could not be encrypted or authenticated",
      );
    }
  });

  it("rejects an unrelated key, malformed envelopes, and oversized data with controlled errors", () => {
    const cipher = ModelCredentialCipher.fromKey(randomBytes(32));
    const encrypted = cipher.encrypt(apiKey, context);
    expect(() =>
      ModelCredentialCipher.fromKey(randomBytes(32)).decrypt(encrypted, context),
    ).toThrow("could not be encrypted or authenticated");
    for (const value of ["", "v2.a.b.c", "v1.a.b.c.extra", `v1.${apiKey}`, "x".repeat(5601)]) {
      expect(() => cipher.decrypt(value, context)).toThrow(
        new Error("Model credential could not be encrypted or authenticated."),
      );
    }
    for (const value of ["", " ", "x".repeat(4097)]) {
      expect(() => cipher.encrypt(value, context)).toThrow(
        new Error("Model credential could not be encrypted or authenticated."),
      );
    }
    expect(() => ModelCredentialCipher.fromKey(randomBytes(31))).toThrow(
      "original protected key file",
    );
  });

  it("copies the supplied key and keeps the key out of enumerable object properties", () => {
    const key = randomBytes(32);
    const original = Buffer.from(key);
    const cipher = ModelCredentialCipher.fromKey(key);
    key.fill(0);
    expect(
      ModelCredentialCipher.fromKey(original).decrypt(cipher.encrypt(apiKey, context), context),
    ).toBe(apiKey);
    expect(JSON.stringify(cipher)).toBe("{}");
  });
});

describe("protected model credential key lifecycle", () => {
  it("atomically initializes once across competing starters and reloads the same 0600 key", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "model-key");
    const ciphers = await Promise.all(
      Array.from({ length: 4 }, () => ModelCredentialCipher.load(path, { allowCreate: true })),
    );
    const persisted = await readFile(path);
    expect(persisted).toHaveLength(32);
    expect((await lstat(path)).mode & 0o777).toBe(0o600);
    const first = ciphers[0];
    if (first === undefined) throw new Error("Test key was not initialized.");
    const encrypted = first.encrypt(apiKey, context);
    for (const cipher of ciphers) expect(cipher.decrypt(encrypted, context)).toBe(apiKey);
    const reloaded = await ModelCredentialCipher.load(path, { allowCreate: false });
    expect(reloaded.decrypt(encrypted, context)).toBe(apiKey);
    expect(await readFile(path)).toEqual(persisted);
    expect(await readdir(directory)).toEqual(["model-key"]);
  });

  it("never recreates a missing key when saved database connections exist", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "missing", "model-key");
    await expect(ModelCredentialCipher.load(path, { allowCreate: false })).rejects.toThrow(
      "original protected key file",
    );
    expect(await readdir(directory)).toEqual([]);
  });

  it("rejects symlinks, directories, invalid lengths, and exposed or altered permissions without replacing files", async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, "target");
    await writeFile(target, randomBytes(32), { mode: 0o600 });
    const link = join(directory, "linked-key");
    await symlink(target, link);
    const childDirectory = join(directory, "directory-key");
    await mkdir(childDirectory);
    const linkedDirectory = join(directory, "linked-directory");
    await symlink(childDirectory, linkedDirectory);
    await writeFile(join(childDirectory, "key"), randomBytes(32), { mode: 0o600 });
    for (const path of [link, childDirectory, join(linkedDirectory, "key")]) {
      await expect(ModelCredentialCipher.load(path, { allowCreate: true })).rejects.toThrow(
        "original protected key file",
      );
    }
    expect((await lstat(link)).isSymbolicLink()).toBe(true);
    for (const size of [0, 31, 33, 100_000]) {
      const path = join(directory, `size-${size}`);
      const bytes = randomBytes(size);
      await writeFile(path, bytes, { mode: 0o600 });
      await expect(ModelCredentialCipher.load(path, { allowCreate: true })).rejects.toThrow(
        "original protected key file",
      );
      expect(await readFile(path)).toEqual(bytes);
    }
    for (const mode of [0o644, 0o660, 0o400, 0o700]) {
      await chmod(target, mode);
      await expect(ModelCredentialCipher.load(target, { allowCreate: true })).rejects.toThrow(
        "original protected key file",
      );
      expect((await lstat(target)).mode & 0o777).toBe(mode);
    }
  });

  it("detects permission drift on reload and rejects ciphertext after key tampering", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "model-key");
    const cipher = await ModelCredentialCipher.load(path, { allowCreate: true });
    const encrypted = cipher.encrypt(apiKey, context);
    await chmod(path, 0o644);
    await expect(ModelCredentialCipher.load(path, { allowCreate: false })).rejects.toThrow(
      "original protected key file",
    );
    await chmod(path, 0o600);
    await writeFile(path, randomBytes(32));
    const changed = await ModelCredentialCipher.load(path, { allowCreate: false });
    expect(() => changed.decrypt(encrypted, context)).toThrow(
      "could not be encrypted or authenticated",
    );
  });
});
