// @vitest-environment jsdom
import type { Bot, Channel } from "@openbot/domain";
import { expect, it, vi } from "vitest";
import { interact, renderComponent, setInputValue } from "../test/render-component";
import { Sidebar } from "./Sidebar";

const channels: Channel[] = [
  {
    id: "design",
    name: "Design",
    description: "Interface review",
    botIds: [],
    createdAt: "2026-09-05T00:00:00Z",
  },
  {
    id: "code",
    name: "开发",
    description: "Release checks",
    botIds: [],
    createdAt: "2026-09-05T00:00:00Z",
  },
];
const bots: Bot[] = [
  {
    id: "reviewer",
    name: "Reviewer",
    role: "Review",
    status: "idle",
    computerProfile: "none",
    createdAt: "2026-09-05T00:00:00Z",
  },
];
it("filters authorized channels and Bots, restores selection and keeps actions functional", async () => {
  const select = vi.fn();
  const create = vi.fn();
  const settings = vi.fn();
  const view = await renderComponent(
    <Sidebar
      bots={bots}
      channels={channels}
      runs={[]}
      ownerName="Owner"
      selectedChannelId="design"
      onSelectChannel={select}
      onSelectBot={vi.fn()}
      onCreateBot={vi.fn()}
      onCreateChannel={create}
      onManageNodes={vi.fn()}
      onLogout={vi.fn()}
      onSettings={settings}
    />,
  );
  try {
    const search = view.container.querySelector('input[type="search"]');
    if (!(search instanceof HTMLInputElement)) throw Error("Search input missing");
    await setInputValue(search, "REVIEW");
    expect(view.container.querySelectorAll(".channel-list-row")).toHaveLength(1);
    expect(view.container.textContent).toContain("Reviewer");
    expect(view.container.textContent).not.toContain("Release checks");
    await setInputValue(search, "not present");
    expect(view.container.textContent).toContain("没有匹配的频道");
    expect(view.container.textContent).toContain("没有匹配的 Bot");
    await setInputValue(search, "");
    const selected = view.container.querySelector('[aria-current="page"]');
    if (!(selected instanceof HTMLButtonElement)) throw Error("Selected channel missing");
    await interact(() => selected.click());
    expect(select).toHaveBeenCalledWith("design");
    const buttons = [...view.container.querySelectorAll("button")];
    await interact(() => buttons.find((button) => button.textContent === "新建对话")?.click());
    await interact(() => buttons.find((button) => button.textContent === "账号与设置")?.click());
    expect(create).toHaveBeenCalledOnce();
    expect(settings).toHaveBeenCalledOnce();
  } finally {
    await view.unmount();
  }
});
