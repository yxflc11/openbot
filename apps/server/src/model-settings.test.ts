import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WindowsSecretAcl } from "@openbot/windows-secret-acl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelSettingsService, modelSettingsInputSchema } from "./model-settings.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fixture(
  fetcher: typeof fetch | undefined = undefined,
  options: {
    platform?: NodeJS.Platform;
    windowsAcl?: WindowsSecretAcl;
  } = {},
) {
  const resolvedFetcher = fetcher ?? vi.fn(async () => Response.json({ id: "test-model" }));
  // Nested dedicated leaf so Windows create+protect applies; never weaken checks for temp parents.
  const dir = await realpath(await mkdtemp(join(tmpdir(), "openbot-model-test-")));
  directories.push(dir);
  const path = join(dir, "private", "model.json");
  const serviceOptions = {
    ...(options.platform === undefined ? {} : { platform: options.platform }),
    ...(options.windowsAcl === undefined ? {} : { windowsAcl: options.windowsAcl }),
    windowsTrustRoot: dir,
  };
  return {
    dir,
    path,
    serviceOptions,
    service: new ModelSettingsService(path, "a".repeat(64), resolvedFetcher, serviceOptions),
    reopen: (fetcherOverride: typeof fetch = resolvedFetcher) =>
      new ModelSettingsService(path, "a".repeat(64), fetcherOverride, serviceOptions),
    fetcher: resolvedFetcher,
  };
}
const input = {
  provider: "openai" as const,
  model: "test-model",
  apiKey: "test-key-private-123456789",
  revision: null,
};
describe(
  "Owner model settings",
  // Real PowerShell ACL verify/protect on every load/save needs a wider per-test budget.
  process.platform === "win32" ? { timeout: 60_000 } : {},
  () => {
    it("verifies K3 against Moonshot's exact model list and retains an encrypted key", async () => {
      const fetcher = vi.fn(async () => Response.json({ data: [{ id: "kimi-k3" }] }));
      const { service, path, reopen } = await fixture(fetcher);
      const saved = await service.save({
        ...input,
        provider: "moonshot",
        model: "kimi-k3",
        agentEnabled: true,
      });
      expect(fetcher).toHaveBeenCalledWith(
        "https://api.moonshot.cn/v1/models",
        expect.objectContaining({
          redirect: "manual",
          headers: expect.objectContaining({ Authorization: `Bearer ${input.apiKey}` }),
        }),
      );
      expect(await readFile(path, "utf8")).not.toContain(input.apiKey);
      const reopened = reopen();
      expect(await reopened.summary()).toEqual(saved);
      expect(await reopened.agentSettings()).toMatchObject({
        provider: "moonshot",
        model: "kimi-k3",
        apiKey: input.apiKey,
      });
      fetcher.mockResolvedValueOnce(Response.json({ data: [{ id: "other-model" }] }));
      await expect(
        service.save({
          ...input,
          provider: "moonshot",
          model: "kimi-k3",
          revision: saved.revision,
        }),
      ).rejects.toMatchObject({ code: "model_unavailable" });
      expect(await reopened.summary()).toEqual(saved);
    });

    it("verifies an OpenRouter inference key and matching tool model without generating a completion", async () => {
      const fetcher = vi.fn(async (url: string) =>
        Response.json(
          url.endsWith("/key")
            ? { data: { is_management_key: false, is_provisioning_key: false } }
            : { data: { id: "fixture/model", endpoints: [{ supported_parameters: ["tools"] }] } },
        ),
      );
      const { service, path, reopen } = await fixture(fetcher);
      const saved = await service.save({
        ...input,
        provider: "openrouter",
        model: "fixture/model",
        agentEnabled: true,
      });
      expect(saved).toMatchObject({
        provider: "openrouter",
        model: "fixture/model",
        agentEnabled: true,
      });
      expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
        "https://openrouter.ai/api/v1/key",
        "https://openrouter.ai/api/v1/models/fixture/model/endpoints",
      ]);
      expect(fetcher).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          redirect: "manual",
          headers: { Accept: "application/json", Authorization: `Bearer ${input.apiKey}` },
        }),
      );
      expect(await readFile(path, "utf8")).not.toContain(input.apiKey);
      expect(await reopen().summary()).toEqual(saved);
    });
    it("rejects management/provisioning keys before requesting model metadata", async () => {
      for (const data of [
        { is_management_key: true },
        { is_management_key: false, is_provisioning_key: true },
        {},
      ]) {
        const fetcher = vi.fn(async () => Response.json({ data }));
        const { service } = await fixture(fetcher);
        await expect(
          service.save({ ...input, provider: "openrouter", model: "fixture/model" }),
        ).rejects.toMatchObject({ code: "invalid_credentials" });
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(await service.summary()).toEqual({ status: "unconfigured", revision: null });
      }
    });
    it("rejects mismatched, unavailable and non-tool-capable OpenRouter models", async () => {
      for (const data of [
        { id: "other/model", endpoints: [{ supported_parameters: ["tools"] }] },
        { id: "fixture/model", endpoints: [] },
        { id: "fixture/model", endpoints: [{ supported_parameters: ["temperature"] }] },
      ]) {
        const fetcher = vi.fn(async (url: string) =>
          Response.json(url.endsWith("/key") ? { data: { is_management_key: false } } : { data }),
        );
        const { service } = await fixture(fetcher);
        await expect(
          service.save({
            ...input,
            provider: "openrouter",
            model: "fixture/model",
            agentEnabled: true,
          }),
        ).rejects.toMatchObject({ code: "model_unavailable" });
        expect(await service.summary()).toEqual({ status: "unconfigured", revision: null });
      }
    });
    it("rejects model URL/path substitution and preserves direct-provider model syntax", () => {
      for (const model of [
        "https://other.example/x",
        "a/../b",
        "a//b",
        "a/b?key=value",
        "a/b#fragment",
        "~openai/latest",
        "a/b/c",
        "a/%2f",
      ]) {
        expect(
          modelSettingsInputSchema.safeParse({ ...input, provider: "openrouter", model }).success,
        ).toBe(false);
      }
      expect(
        modelSettingsInputSchema.safeParse({ ...input, provider: "openai", model: "a/b" }).success,
      ).toBe(false);
      expect(
        modelSettingsInputSchema.safeParse({
          ...input,
          provider: "openrouter",
          model: "fixture/model:free",
        }).success,
      ).toBe(true);
    });
    it("bounds OpenRouter metadata and refuses redirects with no stored key", async () => {
      for (const response of [
        new Response(null, { status: 302, headers: { location: "https://other.example" } }),
        Response.json({ data: { padding: "x".repeat(33000) } }),
      ]) {
        const { service } = await fixture(vi.fn(async () => response));
        await expect(
          service.save({ ...input, provider: "openrouter", model: "fixture/model" }),
        ).rejects.toMatchObject({ code: "provider_unavailable" });
        expect(await service.summary()).toEqual({ status: "unconfigured", revision: null });
      }
    });

    it("requires explicit opt-in, preserves the eligibility boundary, and notifies on disable", async () => {
      const { service, path, reopen } = await fixture();
      expect(await service.agentSettings()).toBeUndefined();
      const legacy = await service.save(input);
      expect(await service.agentSettings()).toBeUndefined();
      expect(await reopen().agentSettings()).toBeUndefined();
      const changed = vi.fn();
      const unsubscribe = service.onChange(changed);
      const enabled = await service.save({
        ...input,
        revision: legacy.revision,
        agentEnabled: true,
      });
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
      const { service, path, fetcher, reopen } = await fixture();
      const result = await service.save(input);
      expect(result).toMatchObject({
        status: "configured",
        provider: "openai",
        model: "test-model",
      });
      expect(JSON.stringify(result)).not.toContain(input.apiKey);
      expect(await readFile(path, "utf8")).not.toContain(input.apiKey);
      expect(fetcher).toHaveBeenCalledWith(
        "https://api.openai.com/v1/models/test-model",
        expect.objectContaining({
          redirect: "manual",
          headers: expect.objectContaining({ Authorization: `Bearer ${input.apiKey}` }),
        }),
      );
      expect(await reopen().summary()).toEqual(result);
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
      const { service } = await fixture(
        vi.fn(async () => Response.json({ id: "x".repeat(40000) })),
      );
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

    it("on win32 protects new directories and verifies before retained reads", async () => {
      const calls: string[] = [];
      const windowsAcl: WindowsSecretAcl = {
        async protectDirectory(_path, created) {
          calls.push(`dir:${created ? "new" : "existing"}`);
        },
        async verifyDirectory() {
          calls.push("dir-verify");
        },
        async protectAndVerifyFile() {
          calls.push("file-protect");
        },
        async verifyFile() {
          calls.push("file-verify");
        },
      };
      const { service } = await fixture(undefined, { platform: "win32", windowsAcl });
      const saved = await service.save(input);
      expect(calls).toEqual(["dir:new", "file-protect", "dir-verify", "file-verify"]);
      calls.length = 0;
      expect(await service.summary()).toEqual(saved);
      expect(calls).toEqual(["dir-verify", "file-verify"]);
      calls.length = 0;
      await service.save({ ...input, revision: saved.revision });
      // save re-reads for conflict checks before rewriting the dedicated directory.
      expect(calls).toContain("dir-verify");
      expect(calls).toContain("dir:existing");
      expect(calls).toContain("file-protect");
    });

    it("on win32 refuses load when the ACL helper reports an unsafe file", async () => {
      const { dir, path } = await fixture();
      await mkdir(join(dir, "private"), { mode: 0o700 });
      await writeFile(path, '{"version":1,"nonce":"x","tag":"y","ciphertext":"z"}', {
        mode: 0o600,
      });
      const service = new ModelSettingsService(path, "a".repeat(64), fetch, {
        platform: "win32",
        windowsTrustRoot: dir,
        windowsAcl: {
          protectDirectory: async () => {},
          verifyDirectory: async () => {},
          protectAndVerifyFile: async () => {},
          verifyFile: async () => {
            throw new Error("Windows secret file ACL verification failed during reading.");
          },
        },
      });
      await expect(service.summary()).rejects.toMatchObject({ code: "storage_unavailable" });
    });
  },
);
