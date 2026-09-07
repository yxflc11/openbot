// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { interact, renderComponent, setInputValue } from "../test/render-component";
import { ModelSettingsScreen } from "./ModelSettingsScreen";

afterEach(() => vi.unstubAllGlobals());
describe("model Agent opt-in", () => {
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
