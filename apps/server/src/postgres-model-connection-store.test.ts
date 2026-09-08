import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ModelCredentialCipher } from "./model-credential-cipher.js";
import { PostgresModelConnectionStore } from "./postgres-model-connection-store.js";

type Database = ConstructorParameters<typeof PostgresModelConnectionStore>[0];
const secret = "test-secret-that-database-diagnostics-must-not-expose";
const input = {
  name: "DeepSeek",
  presetId: "deepseek",
  baseUrl: "https://api.deepseek.com",
  protocol: "openai-chat" as const,
  apiKey: secret,
};

describe("private model connection store boundaries", () => {
  it("does not expose database diagnostics from any public store operation", async () => {
    const fail = () => {
      throw new Error(`Query parameters contained ${secret}`);
    };
    const database = { select: fail, transaction: fail } as unknown as Database;
    const store = new PostgresModelConnectionStore(
      database,
      ModelCredentialCipher.fromKey(randomBytes(32)),
    );
    for (const operation of [
      () => PostgresModelConnectionStore.hasAny(database),
      () => store.list(),
      () => store.get("test-id"),
      () => store.create(input),
      () => store.update("test-id", { expectedRevision: 1, apiKey: secret }),
    ]) {
      await expect(operation()).rejects.toThrow(new Error("Model connection operation failed."));
    }
    expect(JSON.stringify(store)).toBe("{}");
  });

  it("rejects endpoint, protocol, or provider edits before touching the database", async () => {
    const transaction = vi.fn();
    const store = new PostgresModelConnectionStore(
      { transaction } as unknown as Database,
      ModelCredentialCipher.fromKey(randomBytes(32)),
    );
    for (const illegal of [
      { baseUrl: "https://elsewhere.example" },
      { presetId: "openai" },
      { protocol: "anthropic-messages" },
    ]) {
      await expect(
        store.update("test-id", { expectedRevision: 1, name: "Changed", ...illegal }),
      ).rejects.toThrow("update is invalid");
    }
    expect(transaction).not.toHaveBeenCalled();
  });

  it("lists redacted metadata without decrypting and refuses disabled credentials before decrypting", async () => {
    const row = {
      id: "test-id",
      name: "Test",
      presetId: "deepseek",
      baseUrl: input.baseUrl,
      protocol: "openai-chat",
      enabled: false,
      revision: 1,
      encryptedApiKey: "corrupted ciphertext",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const selection = {
      from: () => selection,
      where: () => selection,
      orderBy: () => selection,
      limit: async () => [row],
    };
    const database = { select: () => selection } as unknown as Database;
    const cipher = ModelCredentialCipher.fromKey(randomBytes(32));
    const decrypt = vi.spyOn(cipher, "decrypt");
    const store = new PostgresModelConnectionStore(database, cipher);
    expect(await store.list()).toEqual([
      {
        id: row.id,
        name: row.name,
        presetId: row.presetId,
        baseUrl: row.baseUrl,
        protocol: row.protocol,
        enabled: false,
        revision: 1,
        hasApiKey: true,
        source: "saved",
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    ]);
    await expect(store.get(row.id)).rejects.toThrow("connection is disabled");
    expect(decrypt).not.toHaveBeenCalled();
  });
});
