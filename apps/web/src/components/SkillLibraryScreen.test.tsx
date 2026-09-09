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

function pluginButton(container: HTMLElement, name: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (entry) => entry.textContent?.trim() === name || entry.getAttribute("aria-label") === name,
  );
  if (!button) throw new Error(`Missing plugin button ${name}`);
  return button;
}

it("navigates Bot extensions with the keyboard and exposes actual create/import actions", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ profile: { skills: [] } })),
  );
  const actions = {
    onBack: vi.fn(),
    onCreateBot: vi.fn(),
    onImportBot: vi.fn(),
    onOpenBot: vi.fn(),
  };
  const rendered = await renderComponent(<SkillLibraryScreen bots={bots} {...actions} />);
  try {
    const skillsTab = rendered.container.querySelector<HTMLButtonElement>("#plugin-tab-skills");
    if (!skillsTab) throw new Error("Skills tab is missing");
    await interact(() => {
      skillsTab.focus();
      skillsTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(document.activeElement?.id).toBe("plugin-tab-bots");
    expect(
      rendered.container.querySelector('[role="tabpanel"]')?.getAttribute("aria-labelledby"),
    ).toBe("plugin-tab-bots");
    await interact(() => pluginButton(rendered.container, "创建 Bot").click());
    await interact(() => pluginButton(rendered.container, "导入 Bot").click());
    expect(actions.onCreateBot).toHaveBeenCalledOnce();
    expect(actions.onImportBot).toHaveBeenCalledOnce();
    await setInputValue(
      rendered.container.querySelector('input[type="search"]') as HTMLInputElement,
      "Reviewer",
    );
    expect(rendered.container.querySelectorAll("article")).toHaveLength(1);
    await interact(() =>
      rendered.container.querySelector<HTMLButtonElement>("article button")?.click(),
    );
    expect(actions.onOpenBot).toHaveBeenCalledWith("bot-2");
    await interact(() => pluginButton(rendered.container, "← 返回应用").click());
    expect(actions.onBack).toHaveBeenCalledOnce();
  } finally {
    await rendered.unmount();
  }
});

it("imports a candidate skill for the chosen Server Bot and then opens its review", async () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    Response.json(init?.method === "POST" ? { skill } : { profile: { skills: [] } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const onOpenBot = vi.fn();
  const rendered = await renderComponent(<SkillLibraryScreen bots={bots} onOpenBot={onOpenBot} />);
  try {
    await interact(() => pluginButton(rendered.container, "添加技能").click());
    await interact(() => {
      const select = rendered.container.querySelector<HTMLSelectElement>(
        '[aria-label="技能所属 Bot"]',
      );
      if (!select) throw new Error("Skill target is missing");
      select.value = "bot-2";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const markdown =
      "---\nname: sources\ndescription: Compare sources\n---\nRead the supplied evidence.";
    await interact(() => {
      const textarea = rendered.container.querySelector("textarea");
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (!textarea || !setter) throw new Error("Skill editor is missing");
      setter.call(textarea, markdown);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await interact(() =>
      rendered.container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.[0]).toBe("/api/v1/bots/bot-2/skills/import");
    expect(JSON.parse(writes[0]?.[1]?.body as string)).toEqual({
      markdown,
      version: "1.0.0",
      reason: "Owner imported a single SKILL.md for review.",
    });
    await interact(() => pluginButton(rendered.container, "前往 Bot 档案审核").click());
    expect(onOpenBot).toHaveBeenCalledWith("bot-2");
    expect(fetchMock.mock.calls.some(([url]) => url.includes("/state"))).toBe(false);
  } finally {
    await rendered.unmount();
  }
});

it("offers real Bot creation when adding a skill to an empty workspace", async () => {
  const onCreateBot = vi.fn();
  const rendered = await renderComponent(
    <SkillLibraryScreen bots={[]} onOpenBot={vi.fn()} onCreateBot={onCreateBot} />,
  );
  try {
    await interact(() => pluginButton(rendered.container, "添加技能").click());
    expect(rendered.container.textContent).toContain("先创建或导入一个 Bot");
    expect(rendered.container.querySelector("form")).toBeNull();
    await interact(() => pluginButton(rendered.container, "创建 Bot").click());
    expect(onCreateBot).toHaveBeenCalledOnce();
  } finally {
    await rendered.unmount();
  }
});
