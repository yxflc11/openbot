import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { modelProviderPresets } from "@openbot/domain";
import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { ModelSettingsService, modelSettingsInputSchema } from "./model-settings.js";
import { agentFetch, agentModel } from "./native-agent.js";

const input = {
  provider: "deepseek" as const,
  model: "deepseek-v4-flash",
  apiKey: "fixture-key-not-real",
  revision: null,
  agentEnabled: true,
};
describe("Desktop provider presets", () => {
  it("rejects cross-provider endpoints before credentials are sent", () => {
    expect(modelProviderPresets).toHaveLength(11);
    for (const baseUrl of [
      "https://evil.example/v1",
      "https://api.moonshot.cn/v1",
      "https://api.deepseek.com/?key=x",
    ])
      expect(modelSettingsInputSchema.safeParse({ ...input, baseUrl }).success).toBe(false);
    expect(() =>
      agentModel({
        ...input,
        baseUrl: "https://evil.example",
        revision: "x",
        agentEnabledAt: new Date().toISOString(),
      }),
    ).toThrow(/endpoint/);
  });
  it("retains the selected region and key in encrypted settings and keeps discovery read-only", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openbot-presets-"));
    try {
      const fetcher = vi.fn(async () => Response.json({ data: [{ id: "vendor/model@v1+fast" }] }));
      const path = join(dir, "model.json");
      const service = new ModelSettingsService(path, "a".repeat(64), fetcher);
      const selected = {
        ...input,
        provider: "siliconflow" as const,
        baseUrl: "https://api.siliconflow.com/v1",
        model: "vendor/model@v1+fast",
      };
      expect(
        await service.discover({
          provider: selected.provider,
          baseUrl: selected.baseUrl,
          apiKey: selected.apiKey,
        }),
      ).toEqual([selected.model]);
      expect(await service.summary()).toEqual({ status: "unconfigured", revision: null });
      const result = await service.save(selected);
      expect(result).toMatchObject({
        provider: "siliconflow",
        baseUrl: selected.baseUrl,
        verification: "metadata",
      });
      expect(await new ModelSettingsService(path, "a".repeat(64)).agentSettings()).toMatchObject({
        provider: selected.provider,
        baseUrl: selected.baseUrl,
        apiKey: selected.apiKey,
        model: selected.model,
      });
      expect(await readFile(path, "utf8")).not.toContain(input.apiKey);
      expect(fetcher).toHaveBeenCalledWith(
        `${selected.baseUrl}/models?type=text&sub_type=chat`,
        expect.objectContaining({ redirect: "manual" }),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("does not claim online verification or make a paid request for manual-only providers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openbot-presets-"));
    try {
      const fetcher = vi.fn();
      const service = new ModelSettingsService(join(dir, "model.json"), "a".repeat(64), fetcher);
      expect(
        await service.save({ ...input, provider: "ark", model: "ep-account-model" }),
      ).toMatchObject({ verification: "not_checked" });
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it.each(
    modelProviderPresets.filter(
      (preset) => !["openai", "anthropic", "moonshot", "openrouter"].includes(preset.id),
    ),
  )("uses the released chat adapter for $id with its exact endpoint", async (preset) => {
    const fetcher = vi.fn(async () =>
      Response.json({
        id: "fixture",
        object: "chat.completion",
        created: 1,
        model: "fixture-model",
        choices: [
          { index: 0, finish_reason: "stop", message: { role: "assistant", content: "OK" } },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
    const model = agentModel(
      {
        ...input,
        provider: preset.id,
        model: "fixture-model",
        revision: "x",
        agentEnabledAt: new Date().toISOString(),
      },
      fetcher,
    );
    const result = await generateText({ model, prompt: "Fixture only", maxRetries: 0 });
    expect(result.text).toBe("OK");
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe(`${preset.endpoints[0]?.baseUrl}/chat/completions`);
    expect(new Headers(options.headers).get("authorization")).toBe(`Bearer ${input.apiKey}`);
    expect(options.redirect).toBe("manual");
    if (preset.id === "deepseek")
      expect(JSON.parse(String(options.body)).thinking).toEqual({ type: "disabled" });
    if (preset.id === "minimax")
      expect(JSON.parse(String(options.body)).reasoning_split).toBe(true);
  });
  it("rejects residual MiniMax private reasoning instead of publishing it", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ choices: [{ message: { content: "<think>private</think>answer" } }] }),
    );
    await expect(
      agentFetch("minimax", fetcher)("https://api.minimax.cn/v1/chat/completions", {
        method: "POST",
        body: "{}",
      }),
    ).rejects.toThrow();
  });
});
