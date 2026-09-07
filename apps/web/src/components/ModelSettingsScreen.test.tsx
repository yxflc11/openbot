// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { interact, renderComponent, setInputValue } from "../test/render-component";
import { ModelSettingsScreen } from "./ModelSettingsScreen";

afterEach(() => vi.unstubAllGlobals());
describe("model Agent opt-in", () => {
  it("offers OpenRouter with explicit routing disclosure and clears credentials on provider changes", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
      Response.json(
        init?.method === "POST"
          ? {
              status: "configured",
              provider: "openrouter",
              model: "fixture/model",
              revision: "saved",
              agentEnabled: false,
            }
          : { status: "unconfigured", revision: null },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const view = await renderComponent(<ModelSettingsScreen embedded onDone={() => {}} />);
    try {
      const key = view.container.querySelector<HTMLInputElement>("#model-api-key");
      const model = view.container.querySelector<HTMLInputElement>("#model-name");
      if (!key || !model) throw new Error("Missing inputs");
      await setInputValue(key, "fixture-key-123456789");
      const router = [...view.container.querySelectorAll("label")]
        .find((label) => label.textContent === "OpenRouter")
        ?.querySelector("input");
      await interact(() => router?.click());
      expect(key.value).toBe("");
      expect(model.placeholder).toContain("author/model");
      expect(view.container.textContent).toContain("OpenRouter 会将任务交给其模型提供商");
      expect(view.container.textContent).toContain("不生成付费回复");
      await setInputValue(model, "fixture/model");
      await setInputValue(key, "fixture-key-123456789");
      await interact(() =>
        view.container
          .querySelector("form")
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
      );
      const [, init] = fetcher.mock.calls.find(([, value]) => value?.method === "POST") ?? [];
      expect(JSON.parse(String(init?.body))).toMatchObject({
        provider: "openrouter",
        model: "fixture/model",
        agentEnabled: false,
      });
      expect(key.value).toBe("");
    } finally {
      await view.unmount();
    }
  });

  it("defaults off, discloses context transmission, and submits only the Owner's checked choice", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
      Response.json(
        init?.method === "POST"
          ? {
              status: "configured",
              provider: "openai",
              model: "test-model",
              revision: "revision",
              agentEnabled: true,
            }
          : { status: "unconfigured", revision: null },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const rendered = await renderComponent(<ModelSettingsScreen embedded onDone={() => {}} />);
    try {
      const checkbox = rendered.container.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
      expect(rendered.container.textContent).toContain("API 费用");
      await setInputValue(
        rendered.container.querySelector("#model-name") as HTMLInputElement,
        "test-model",
      );
      await setInputValue(
        rendered.container.querySelector("#model-api-key") as HTMLInputElement,
        "fixture-key-123456789",
      );
      await interact(() => checkbox.click());
      await interact(() =>
        rendered.container
          .querySelector("form")
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
      );
      const [, init] = fetcher.mock.calls.find(([, options]) => options?.method === "POST") ?? [];
      expect(JSON.parse(String(init?.body))).toMatchObject({
        agentEnabled: true,
        revision: null,
        provider: "openai",
      });
      expect((rendered.container.querySelector("#model-api-key") as HTMLInputElement).value).toBe(
        "",
      );
    } finally {
      await rendered.unmount();
    }
  });
});
