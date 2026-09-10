// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { deferred, interact, renderComponent } from "../test/render-component";
import { ChannelMembersMenu } from "./ChannelMembersMenu";
import { MessageReactions } from "./MessageReactions";

describe("message reaction and removal controls", () => {
  it("marks my existing choice and disables duplicate writes until the Server responds", async () => {
    const result = deferred<void>(),
      onChange = vi.fn(() => result.promise);
    const view = await renderComponent(
      <MessageReactions
        messageId="message"
        reactions={[{ messageId: "message", emoji: "👍", actor: "owner" }]}
        onChange={onChange}
      />,
    );
    const chip = view.container.querySelector("button") as HTMLButtonElement;
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    await interact(() => chip.click());
    expect(onChange).toHaveBeenCalledWith("👍", false);
    expect(chip.disabled).toBe(true);
    await interact(() => result.reject(new Error("Save failed")));
    expect(view.container.querySelector('[role="alert"]')?.textContent).toBe("Save failed");
    expect(chip.disabled).toBe(false);
    await view.unmount();
  });
  it("offers removal only for group members and surfaces a failed removal", async () => {
    const bot = {
      id: "bot",
      name: "Bot",
      role: "Research",
      status: "idle" as const,
      computerProfile: "none" as const,
      createdAt: new Date().toISOString(),
    };
    const channel = {
      id: "channel",
      name: "Channel",
      description: "",
      botIds: [bot.id],
      createdAt: bot.createdAt,
    };
    const onRemove = vi.fn(async () => {
      throw new Error("Removal failed");
    });
    const view = await renderComponent(
      <ChannelMembersMenu
        channel={channel}
        bots={[bot]}
        onJoin={vi.fn()}
        onOpenBot={vi.fn()}
        onRemove={onRemove}
      />,
    );
    const remove = view.container.querySelector(".channel-member-remove") as HTMLButtonElement;
    await interact(() => remove.click());
    expect(onRemove).toHaveBeenCalledWith(bot.id);
    expect(view.container.querySelector('[role="alert"]')?.textContent).toBe("Removal failed");
    await view.unmount();
    const direct = await renderComponent(
      <ChannelMembersMenu
        channel={{ ...channel, directBotId: bot.id }}
        bots={[bot]}
        onJoin={vi.fn()}
        onOpenBot={vi.fn()}
        onRemove={onRemove}
      />,
    );
    expect(direct.container.querySelector(".channel-member-remove")).toBeNull();
    await direct.unmount();
  });
});
