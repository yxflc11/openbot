// @vitest-environment jsdom
import { type DOMWindow, JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopSetupPlanInput } from "../desktop-runtime";
import { interact, renderComponent, setInputValue } from "../test/render-component";

let Settings: typeof import("./DesktopSettingsScreen").DesktopSettingsScreen;
let preferences: typeof import("../workspace-preferences");
let storageWindow: DOMWindow;
beforeEach(async () => {
  vi.resetModules();
  // Use a browser Storage instance even when Node exposes its own global web storage.
  storageWindow = new JSDOM("", { url: "https://openbot.test" }).window;
  vi.stubGlobal("localStorage", storageWindow.localStorage);
  vi.stubGlobal("sessionStorage", storageWindow.sessionStorage);
  localStorage.clear();
  preferences = await import("../workspace-preferences");
  Settings = (await import("./DesktopSettingsScreen")).DesktopSettingsScreen;
});
afterEach(() => {
  storageWindow.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const hostPlan: DesktopSetupPlanInput = { mode: "host", localWorker: false, plannedWorkerCount: 0 };
function callbacks() {
  return { onBack: vi.fn(), onConnection: vi.fn(), onRole: vi.fn(), onWorker: vi.fn() };
}
function button(container: HTMLElement, name: string): HTMLButtonElement {
  const result = Array.from(container.querySelectorAll("button")).find(
    (item) => item.textContent?.trim() === name || item.getAttribute("aria-label") === name,
  );
  if (!result) throw new Error(`Missing settings button: ${name}`);
  return result;
}
async function select(container: HTMLElement, label: string, value: string) {
  await interact(() => {
    const element = container.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement;
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
function stored() {
  return JSON.parse(localStorage.getItem(preferences.preferencesKey) ?? "null");
}

describe("Desktop settings interactions", () => {
  it("updates actual persisted appearance and chat preferences and restores defaults", async () => {
    const rendered = await renderComponent(
      <Settings plan={hostPlan} material={{ status: "enabled" }} {...callbacks()} />,
    );
    try {
      await interact(() =>
        rendered.container.querySelector<HTMLInputElement>('[aria-label="半透明侧栏"]')?.click(),
      );
      await interact(() =>
        rendered.container
          .querySelector<HTMLInputElement>('[aria-label="显示右侧信息栏"]')
          ?.click(),
      );
      await interact(() =>
        rendered.container.querySelector<HTMLInputElement>('[aria-label="显示左侧导航"]')?.click(),
      );
      await select(rendered.container, "界面密度", "compact");
      await select(rendered.container, "聊天字号", "large");
      await select(rendered.container, "发送消息快捷键", "modifier");
      await select(rendered.container, "消息时间格式", "12");
      await interact(() =>
        rendered.container.querySelector<HTMLInputElement>('[aria-label="减少动态效果"]')?.click(),
      );
      expect(stored()).toEqual({
        sidebarTranslucent: false,
        leftPanelOpen: false,
        rightPanelOpen: false,
        density: "compact",
        fontSize: "large",
        sendShortcut: "modifier",
        reduceMotion: true,
        hour12: true,
      });
      await interact(() => button(rendered.container, "隐私与数据").click());
      await interact(() => button(rendered.container, "恢复默认").click());
      expect(stored()).toEqual(preferences.defaultPreferences);
      expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain(
        "已恢复默认",
      );
      await interact(() => button(rendered.container, "通用与外观").click());
      expect(
        (rendered.container.querySelector('[aria-label="半透明侧栏"]') as HTMLInputElement).checked,
      ).toBe(true);
      expect(
        (rendered.container.querySelector('[aria-label="发送消息快捷键"]') as HTMLSelectElement)
          .value,
      ).toBe("enter");
    } finally {
      await rendered.unmount();
    }
  });

  it("reports nonpersistent preferences while controls still work", async () => {
    vi.spyOn(Object.getPrototypeOf(localStorage), "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });
    const rendered = await renderComponent(
      <Settings plan={hostPlan} material={{ status: "reduced" }} {...callbacks()} />,
    );
    try {
      expect(rendered.container.textContent).toContain("系统已启用减少透明度");
      await select(rendered.container, "界面密度", "compact");
      expect(
        (rendered.container.querySelector('[aria-label="界面密度"]') as HTMLSelectElement).value,
      ).toBe("compact");
      expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain(
        "无法保存到此设备",
      );
      expect(localStorage.getItem(preferences.preferencesKey)).toBeNull();
    } finally {
      await rendered.unmount();
    }
  });

  it.each(["host", "client"] as const)(
    "routes %s connection actions without editing runtime state itself",
    async (mode) => {
      const actions = callbacks();
      const rendered = await renderComponent(
        <Settings
          plan={{ ...hostPlan, mode }}
          connection={{ status: "configured", serverUrl: "https://server.example.test" }}
          localWorker={{ status: "requires-approval" }}
          material={{ status: "unsupported" }}
          {...actions}
        />,
      );
      try {
        await interact(() => button(rendered.container, "服务与工作电脑").click());
        expect(rendered.container.textContent).toContain("https://server.example.test");
        expect(rendered.container.textContent).toContain("等待你在系统中批准");
        await interact(() => button(rendered.container, "更改用途").click());
        await interact(() => button(rendered.container, "管理工作电脑").click());
        expect(actions.onRole).toHaveBeenCalledOnce();
        expect(actions.onWorker).toHaveBeenCalledOnce();
        if (mode === "client") {
          await interact(() => button(rendered.container, "更改连接").click());
          expect(actions.onConnection).toHaveBeenCalledOnce();
        } else {
          expect(rendered.container.textContent).toContain("仅本机");
          expect(
            Array.from(rendered.container.querySelectorAll("button")).some(
              (item) => item.textContent === "更改连接",
            ),
          ).toBe(false);
        }
        await interact(() => button(rendered.container, "关闭设置").click());
        expect(actions.onBack).toHaveBeenCalledOnce();
        expect(localStorage.getItem(preferences.preferencesKey)).toBeNull();
      } finally {
        await rendered.unmount();
      }
    },
  );

  it("loads and saves the model section through the Server rather than local preferences", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? Response.json({
            status: "configured",
            provider: "anthropic",
            model: "available-model",
            revision: "revision-2",
          })
        : Response.json({ status: "unconfigured", revision: null }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const rendered = await renderComponent(
      <Settings plan={hostPlan} material={{ status: "enabled" }} {...callbacks()} />,
    );
    try {
      expect(fetchMock).not.toHaveBeenCalled();
      await interact(() => button(rendered.container, "模型与 API").click());
      await interact(() =>
        Array.from(
          rendered.container.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
        )[1]?.click(),
      );
      await setInputValue(
        rendered.container.querySelector("#model-name") as HTMLInputElement,
        "available-model",
      );
      await setInputValue(
        rendered.container.querySelector("#model-api-key") as HTMLInputElement,
        "test-key-for-ui-validation-only",
      );
      await interact(() =>
        rendered.container
          .querySelector("form")
          ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
      );
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(call?.[0]).toBe("/api/v1/settings/model");
      expect(JSON.parse(call?.[1]?.body as string)).toEqual({
        agentEnabled: false,
        provider: "anthropic",
        model: "available-model",
        apiKey: "test-key-for-ui-validation-only",
        revision: null,
      });
      expect((rendered.container.querySelector("#model-api-key") as HTMLInputElement).value).toBe(
        "",
      );
      expect(rendered.container.querySelector('[role="status"]')?.textContent).toContain(
        "模型配置已验证并保存",
      );
      expect(localStorage.getItem(preferences.preferencesKey)).toBeNull();
    } finally {
      await rendered.unmount();
    }
  });
});
