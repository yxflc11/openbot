import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelSettingsService } from "./model-settings.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fixture(
  fetcher: typeof fetch = vi.fn(async () => Response.json({ id: "test-model" })),
) {
  const dir = await mkdtemp(join(tmpdir(), "openbot-model-test-"));
  directories.push(dir);
  return {
    path: join(dir, "model.json"),
    service: new ModelSettingsService(join(dir, "model.json"), "a".repeat(64), fetcher),
    fetcher,
  };
}
const input = {
  provider: "openai" as const,
  model: "test-model",
  apiKey: "test-key-private-123456789",
  revision: null,
};
describe("Owner model settings", () => {
  it("requires explicit opt-in, preserves the eligibility boundary, and notifies on disable", async () => {
    const { service, path } = await fixture();
    expect(await service.agentSettings()).toBeUndefined();
    const legacy = await service.save(input);
    expect(await service.agentSettings()).toBeUndefined();
    expect(await new ModelSettingsService(path, "a".repeat(64)).agentSettings()).toBeUndefined();
    const changed = vi.fn();
    const unsubscribe = service.onChange(changed);
    const enabled = await service.save({ ...input, revision: legacy.revision, agentEnabled: true });
    const settings = await service.agentSettings();
    expect(settings?.agentEnabledAt).toEqual(expect.any(String));
    expect(JSON.stringify(enabled)).not.toContain(input.apiKey);
    expect(changed).toHaveBeenCalledTimes(1);
    const updated = await service.save({
      ...input,
      revision: enabled.revision,
      agentEnabled: true,
    });
    expect((await service.agentSettings())?.agentEnabledAt).toBe(settings?.agentEnabledAt);
    await service.save({ ...input, revision: updated.revision, agentEnabled: false });
    expect(await service.agentSettings()).toBeUndefined();
    expect(changed).toHaveBeenCalledTimes(3);
    unsubscribe();
  });
  it("validates with the official provider, encrypts the key and only returns a public summary", async () => {
    const { service, path, fetcher } = await fixture();
    const result = await service.save(input);
    expect(result).toMatchObject({ status: "configured", provider: "openai", model: "test-model" });
    expect(JSON.stringify(result)).not.toContain(input.apiKey);
    expect(await readFile(path, "utf8")).not.toContain(input.apiKey);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models/test-model",
      expect.objectContaining({
        redirect: "manual",
        headers: expect.objectContaining({ Authorization: `Bearer ${input.apiKey}` }),
      }),
    );
    expect(await new ModelSettingsService(path, "a".repeat(64)).summary()).toEqual(result);
    await expect(service.save(input)).rejects.toMatchObject({ code: "conflict" });
  });
  it("sends Anthropic headers only to Anthropic", async () => {
    const { service, fetcher } = await fixture();
    await service.save({ ...input, provider: "anthropic" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/models/test-model",
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          "x-api-key": input.apiKey,
          "anthropic-version": "2023-06-01",
        },
      }),
    );
  });
  it.each([401, 403, 404, 302, 429, 500])(
    "does not save rejected credentials or provider response (%s)",
    async (status) => {
      const { service } = await fixture(
        vi.fn(async () => new Response("private upstream error", { status })),
      );
      await expect(service.save(input)).rejects.toThrow(
        /invalid_credentials|model_unavailable|provider_unavailable/u,
      );
      expect(await service.summary()).toEqual({ status: "unconfigured", revision: null });
    },
  );
  it("rejects oversized metadata and never returns upstream content", async () => {
    const { service } = await fixture(vi.fn(async () => Response.json({ id: "x".repeat(40000) })));
    await expect(service.save(input)).rejects.toMatchObject({ code: "provider_unavailable" });
  });
  it("does not overwrite corrupted ciphertext", async () => {
    const { service, path } = await fixture();
    await service.save(input);
    const envelope = JSON.parse(await readFile(path, "utf8"));
    envelope.tag = Buffer.alloc(16).toString("base64");
    await writeFile(path, JSON.stringify(envelope));
    await expect(service.summary()).rejects.toMatchObject({ code: "storage_unavailable" });
    await expect(service.save(input)).rejects.toMatchObject({ code: "storage_unavailable" });
  });
  it.skipIf(process.platform === "win32")("rejects exposed key files", async () => {
    const { service, path } = await fixture();
    await service.save(input);
    await chmod(path, 0o644);
    await expect(service.summary()).rejects.toMatchObject({ code: "storage_unavailable" });
  });
  it("serializes verification and rejects another save while waiting", async () => {
    let finish: ((value: Response) => void) | undefined;
    const { service } = await fixture(
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const first = service.save(input);
    await expect(service.save(input)).rejects.toMatchObject({ code: "busy" });
    await vi.waitFor(() => expect(finish).toBeDefined());
    finish?.(Response.json({ id: "test-model" }));
    await first;
  });
});
