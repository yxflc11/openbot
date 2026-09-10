// @vitest-environment jsdom
import type { Artifact } from "@openbot/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { interact, renderComponent } from "../test/render-component";
import { ArtifactCard } from "./ArtifactCard";

import { getOpenBotDesktopBridge } from "../desktop-runtime";
vi.mock("../desktop-runtime", () => ({ getOpenBotDesktopBridge: vi.fn() }));
afterEach(() => vi.mocked(getOpenBotDesktopBridge).mockReset());
const artifact: Artifact = {
  id: "report-id",
  runId: "run-id",
  name: "研究报告.md",
  mediaType: "text/markdown",
  sha256: "a".repeat(64),
  sizeBytes: 1234,
  createdAt: "2026-09-08T00:00:00.000Z",
};
describe("task report card", () => {
  it("offers a named download without trying to load text as an image or a new window", async () => {
    const view = await renderComponent(<ArtifactCard artifact={artifact} />);
    try {
      const link = view.container.querySelector("a");
      expect(link?.getAttribute("download")).toBe("研究报告.md");
      expect(link?.getAttribute("href")).toBe("/api/v1/artifacts/report-id/content");
      expect(link?.getAttribute("target")).toBeNull();
      expect(view.container.querySelector("img")).toBeNull();
      expect(view.container.textContent).toContain("Markdown 报告");
    } finally {
      await view.unmount();
    }
  });
  it("uses the native save bridge with only artifact identity and displays its result", async () => {
    const saveReport = vi.fn(async () => ({ status: "saved" as const }));
    vi.mocked(getOpenBotDesktopBridge).mockReturnValue({ saveReport } as unknown as NonNullable<
      ReturnType<typeof getOpenBotDesktopBridge>
    >);
    const view = await renderComponent(<ArtifactCard artifact={artifact} />);
    try {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      await interact(() => view.container.querySelector("a")?.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(true);
      expect(saveReport).toHaveBeenCalledExactlyOnceWith(artifact.id);
      expect(view.container.textContent).toContain("报告已保存");
    } finally {
      await view.unmount();
    }
  });
  it("retains the existing image preview path for PNG artifacts", async () => {
    const view = await renderComponent(
      <ArtifactCard artifact={{ ...artifact, name: "capture.png", mediaType: "image/png" }} />,
    );
    try {
      expect(view.container.querySelector("img")?.getAttribute("alt")).toBe("capture.png");
      expect(view.container.querySelector("a")?.getAttribute("download")).toBeNull();
      expect(view.container.querySelector("a")?.getAttribute("target")).toBe("_blank");
    } finally {
      await view.unmount();
    }
  });
  it("downloads a PNG through the native bridge when requested by the share list", async () => {
    const saveReport = vi.fn(async () => ({ status: "saved" as const }));
    vi.mocked(getOpenBotDesktopBridge).mockReturnValue({ saveReport } as unknown as NonNullable<
      ReturnType<typeof getOpenBotDesktopBridge>
    >);
    const view = await renderComponent(
      <ArtifactCard
        artifact={{ ...artifact, name: "capture.png", mediaType: "image/png" }}
        downloadImage
      />,
    );
    try {
      const link = view.container.querySelector("a");
      expect(link?.getAttribute("download")).toBe("capture.png");
      expect(link?.getAttribute("target")).toBeNull();
      expect(link?.getAttribute("aria-label")).toBe("下载 capture.png");
      const event = new MouseEvent("click", { bubbles: true, cancelable: true });
      await interact(() => link?.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(true);
      expect(saveReport).toHaveBeenCalledExactlyOnceWith(artifact.id);
      expect(view.container.textContent).toContain("图片已保存");
    } finally {
      await view.unmount();
    }
  });
  it("keeps a browser download link when the native bridge is absent", async () => {
    const view = await renderComponent(
      <ArtifactCard
        artifact={{ ...artifact, name: "capture.png", mediaType: "image/png" }}
        downloadImage
      />,
    );
    try {
      const link = view.container.querySelector("a");
      expect(link?.getAttribute("download")).toBe("capture.png");
      expect(link?.getAttribute("target")).toBeNull();
      expect(link?.getAttribute("href")).toBe("/api/v1/artifacts/report-id/content");
    } finally {
      await view.unmount();
    }
  });
});
