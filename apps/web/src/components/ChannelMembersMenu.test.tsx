// @vitest-environment jsdom
import type { Bot, Channel } from "@openbot/domain";
import { describe, expect, it, vi } from "vitest";
import { deferred, interact, renderComponent } from "../test/render-component";
import { ChannelMembersMenu } from "./ChannelMembersMenu";

const bots: Bot[] = ["first", "second"].map((id) => ({
  id,
  name: id,
  role: "Research",
  status: "idle",
  computerProfile: "none",
  createdAt: "2026-09-05T00:00:00Z",
}));
const channel: Channel = {
  id: "channel",
  name: "Channel",
  description: "",
  botIds: ["first"],
  createdAt: "2026-09-05T00:00:00Z",
};

describe("ChannelMembersMenu", () => {
  it("joins through the existing action once and exposes a failed mutation inside the disclosure", async () => {
    const response = deferred<void>();
    const onJoin = vi.fn(() => response.promise);
    const rendered = await renderComponent(
      <ChannelMembersMenu channel={channel} bots={bots} onJoin={onJoin} onOpenBot={vi.fn()} />,
    );
    const details = rendered.container.querySelector("details") as HTMLDetailsElement;
    const form = rendered.container.querySelector("form") as HTMLFormElement;
    await interact(() => {
      details.open = true;
      form.requestSubmit();
    });
    await interact(() =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(onJoin).toHaveBeenCalledExactlyOnceWith("second");
    await interact(() => response.reject(new Error("Membership changed")));
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe(
      "Membership changed",
    );
    expect(details.open).toBe(true);
    await rendered.unmount();
  });
  it("returns focus to the native disclosure summary on Escape", async () => {
    const rendered = await renderComponent(
      <ChannelMembersMenu channel={channel} bots={bots} onJoin={vi.fn()} onOpenBot={vi.fn()} />,
    );
    const details = rendered.container.querySelector("details") as HTMLDetailsElement;
    const summary = rendered.container.querySelector("summary") as HTMLElement;
    await interact(() => {
      details.open = true;
      details.querySelector("button")?.focus();
      details.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
    await rendered.unmount();
  });

  it("reflects membership after runtime remove and keeps remove errors visible in the disclosure", async () => {
    const response = deferred<void>();
    const onRemove = vi.fn(() => response.promise);
    const rendered = await renderComponent(
      <ChannelMembersMenu
        channel={channel}
        bots={bots}
        onJoin={vi.fn()}
        onOpenBot={vi.fn()}
        onRemove={onRemove}
      />,
    );
    const details = rendered.container.querySelector("details") as HTMLDetailsElement;
    await interact(() => {
      details.open = true;
    });
    expect(rendered.container.textContent).toContain("first");
    const remove = rendered.container.querySelector(
      ".channel-member-remove",
    ) as HTMLButtonElement;
    await interact(() => remove.click());
    expect(onRemove).toHaveBeenCalledExactlyOnceWith("first");
    expect(remove.textContent).toContain("移除中");
    await interact(() => response.reject(new Error("Bot still has protected work")));
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe(
      "Bot still has protected work",
    );
    expect(details.open).toBe(true);
    await rendered.unmount();
    const cleared = await renderComponent(
      <ChannelMembersMenu
        channel={{ ...channel, botIds: [] }}
        bots={bots}
        onJoin={vi.fn()}
        onOpenBot={vi.fn()}
        onRemove={onRemove}
      />,
    );
    expect(cleared.container.querySelector(".channel-member-remove")).toBeNull();
    expect(cleared.container.textContent).toContain("频道还没有 Bot");
    await cleared.unmount();
  });
});
