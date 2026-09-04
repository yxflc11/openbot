// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { interact, renderComponent, setInputValue } from "../test/render-component";
import { DesktopSetupScreen } from "./DesktopSetupScreen";

describe("DesktopSetupScreen", () => {
  it("turns a five-computer choice into an explicit, non-authoritative checklist", async () => {
    const onSave = vi.fn(async (plan) => ({ status: "configured" as const, plan }));
    const rendered = await renderComponent(
      <DesktopSetupScreen state={{ status: "unconfigured" }} onSave={onSave} />,
    );
    try {
      expect(rendered.container.textContent).toContain("选择安装方式");
      expect(rendered.container.querySelectorAll("input[type='radio']")).toHaveLength(4);
      expect(getSubmitButton(rendered.container).disabled).toBe(true);

      const mode = rendered.container.querySelector("#desktop-mode-client-worker");
      if (!(mode instanceof HTMLInputElement)) throw new Error("Client and Worker mode not found.");
      await interact(() => mode.click());
      const count = rendered.container.querySelector("#planned-worker-count");
      if (!(count instanceof HTMLInputElement)) throw new Error("Worker count input not found.");
      expect(count.value).toBe("1");
      await setInputValue(count, "5");

      expect(rendered.container.textContent).toContain("工作电脑 5");
      expect(rendered.container.textContent).toContain("尚未登记或授权");
      expect(rendered.container.querySelectorAll(".setup-checklist li")).toHaveLength(7);
      const form = rendered.container.querySelector("form");
      if (form === null) throw new Error("Setup form not found.");
      await interact(() =>
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
      );
      expect(onSave).toHaveBeenCalledWith({
        mode: "client-worker",
        plannedWorkerCount: 5,
        localWorker: true,
      });
    } finally {
      await rendered.unmount();
    }
  });

  it("keeps local Worker selection explicit for a hosting plan", async () => {
    const onSave = vi.fn(async (plan) => ({ status: "configured" as const, plan }));
    const rendered = await renderComponent(
      <DesktopSetupScreen state={{ status: "unconfigured" }} onSave={onSave} />,
    );
    try {
      const mode = rendered.container.querySelector("#desktop-mode-host");
      if (!(mode instanceof HTMLInputElement)) throw new Error("Host mode not found.");
      await interact(() => mode.click());
      expect(rendered.container.textContent).toContain("自动 Server/PostgreSQL 安装器尚未交付");
      const localWorker = rendered.container.querySelector("input[type='checkbox']");
      if (!(localWorker instanceof HTMLInputElement))
        throw new Error("Local Worker choice missing.");
      await interact(() => localWorker.click());
      expect(
        (rendered.container.querySelector("#planned-worker-count") as HTMLInputElement).value,
      ).toBe("1");
      expect(rendered.container.textContent).toContain("工作电脑 1：这台电脑");
    } finally {
      await rendered.unmount();
    }
  });

  it("fails visibly for invalid retained state and bounded storage errors", async () => {
    const onSave = vi.fn(async () => ({
      status: "failed" as const,
      code: "storage_unavailable" as const,
    }));
    const rendered = await renderComponent(
      <DesktopSetupScreen state={{ status: "invalid" }} onSave={onSave} />,
    );
    try {
      expect(rendered.container.textContent).toContain("已保存的安装计划无效");
      const mode = rendered.container.querySelector("#desktop-mode-client");
      if (!(mode instanceof HTMLInputElement)) throw new Error("Client mode not found.");
      await interact(() => mode.click());
      const form = rendered.container.querySelector("form");
      if (form === null) throw new Error("Setup form not found.");
      await interact(() =>
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
      );
      expect(rendered.container.textContent).toContain("无法安全保存安装计划");
      expect(getSubmitButton(rendered.container).disabled).toBe(false);
    } finally {
      await rendered.unmount();
    }
  });
});

function getSubmitButton(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector("button[type='submit']");
  if (!(button instanceof HTMLButtonElement)) throw new Error("Submit button not found.");
  return button;
}
