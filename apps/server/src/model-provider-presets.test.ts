import { describe, expect, it } from "vitest";
import { modelProviderPresets } from "./model-provider-presets.js";

describe("reviewed model provider catalog", () => {
  it("keeps providers distinct from models and account-specific endpoint IDs", () => {
    expect(modelProviderPresets.map((preset) => preset.id)).toEqual([
      "openai",
      "anthropic",
      "gemini",
      "deepseek",
      "kimi",
      "openrouter",
      "siliconflow",
      "dashscope",
      "zai",
      "minimax",
      "ark",
      "custom",
    ]);
    for (const id of ["openrouter", "siliconflow", "ark", "custom"]) {
      expect(modelProviderPresets.find((preset) => preset.id === id)?.suggestedModels).toEqual([]);
    }
    expect(modelProviderPresets.find((preset) => preset.id === "custom")?.endpoints).toEqual([]);
  });

  it("only publishes reviewed HTTPS routes without credentials or query overrides", () => {
    for (const preset of modelProviderPresets) {
      expect(new URL(preset.docsUrl).protocol).toBe("https:");
      for (const endpoint of preset.endpoints) {
        const url = new URL(endpoint.baseUrl);
        expect(url.protocol).toBe("https:");
        expect(url.username + url.password + url.search + url.hash).toBe("");
        expect(endpoint.baseUrl).not.toMatch(/\/$/);
      }
    }
  });

  it("does not suggest retired Kimi models or unverified model discovery", () => {
    expect(modelProviderPresets.find((preset) => preset.id === "kimi")?.suggestedModels).toEqual([
      "kimi-k2.6",
      "kimi-k3",
      "kimi-k2.7-code",
    ]);
    for (const id of ["dashscope", "zai", "ark"]) {
      expect(modelProviderPresets.find((preset) => preset.id === id)?.discovery).toBe(false);
    }
    expect(
      modelProviderPresets
        .filter((preset) => preset.protocol === "anthropic-messages")
        .map((preset) => preset.id),
    ).toEqual(["anthropic"]);
  });
});
