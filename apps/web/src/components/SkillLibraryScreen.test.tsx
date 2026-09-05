// @vitest-environment jsdom
import type { Bot } from "@openbot/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { interact, renderComponent, setInputValue } from "../test/render-component";
import { SkillLibraryScreen } from "./SkillLibraryScreen";

const bots: Bot[] = [
  {
    id: "bot-1",
    name: "Researcher",
    role: "Research",
    status: "idle",
    computerProfile: "none",
    createdAt: "2026-09-05T00:00:00Z",
  },
  {
    id: "bot-2",
    name: "Reviewer",
    role: "Review",
    status: "idle",
    computerProfile: "none",
    createdAt: "2026-09-05T00:00:00Z",
  },
];
const skill = {
  id: "skill-1",
  slug: "source-check",
  name: "来源核查",
  description: "比较独立来源",
  version: "1.0.0",
  source: "learned",
  state: "candidate",
  confidence: 0,
  requiredCapabilities: ["browser.observe"],
  dependencyIds: [],
  evidence: [],
  acquiredAt: "2026-09-05T00:00:00Z",
  updatedAt: "2026-09-05T00:00:00Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("SkillLibraryScreen", () => {
  it("searches actual Server records and opens their existing Owner review", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
      Response.json({
        profile: {
          skills: url.includes("bot-1")
            ? [skill]
            : [{ ...skill, id: "skill-2", name: "文档检查", state: "verified" }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onOpenBot = vi.fn();
    const rendered = await renderComponent(
      <SkillLibraryScreen bots={bots} onOpenBot={onOpenBot} />,
    );
    try {
      expect(rendered.container.querySelectorAll("article")).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(rendered.container.textContent).toContain("外部技能商店尚未接入");
      await setInputValue(
        rendered.container.querySelector('input[type="search"]') as HTMLInputElement,
        "researcher",
      );
      expect(rendered.container.querySelectorAll("article")).toHaveLength(1);
      expect(rendered.container.textContent).toContain("来源核查");
      await interact(() =>
        rendered.container.querySelector<HTMLButtonElement>("article button")?.click(),
      );
      expect(onOpenBot).toHaveBeenCalledWith("bot-1");
      await setInputValue(
        rendered.container.querySelector('input[type="search"]') as HTMLInputElement,
        "",
      );
      await interact(() =>
        Array.from(rendered.container.querySelectorAll<HTMLButtonElement>("fieldset button"))
          .find((button) => button.textContent === "已验证")
          ?.click(),
      );
      expect(rendered.container.querySelectorAll("article")).toHaveLength(1);
      expect(rendered.container.querySelector("article")?.textContent).toContain("文档检查");
      expect(
        fetchMock.mock.calls.every(([, init]) => !(init as RequestInit | undefined)?.method),
      ).toBe(true);
    } finally {
      await rendered.unmount();
    }
  });

  it("names failed profiles without presenting them as empty and retries", async () => {
    let unavailable = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, _init?: RequestInit) =>
        url.includes("bot-2") && unavailable
          ? Response.json({ error: "Unavailable" }, { status: 503 })
          : Response.json({ profile: { skills: [skill] } }),
      ),
    );
    const rendered = await renderComponent(<SkillLibraryScreen bots={bots} onOpenBot={vi.fn()} />);
    try {
      expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain("Reviewer");
      expect(rendered.container.querySelectorAll("article")).toHaveLength(1);
      unavailable = false;
      await interact(() =>
        Array.from(rendered.container.querySelectorAll<HTMLButtonElement>("button"))
          .find((button) => button.textContent === "刷新")
          ?.click(),
      );
      expect(rendered.container.querySelector('[role="alert"]')).toBeNull();
      expect(rendered.container.querySelectorAll("article")).toHaveLength(2);
    } finally {
      await rendered.unmount();
    }
  });
});
