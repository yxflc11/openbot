// @vitest-environment jsdom
import type { Bot, Channel, Message, Run, SubmitTaskResult } from "@openbot/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMessage, listMessages, listRuns, subscribeToChannelEvents } from "../api";
import { createConversationSession } from "../conversation-session";
import { deferred, interact, renderComponent } from "../test/render-component";
import { ChannelWorkspace } from "./ChannelWorkspace";

vi.mock("../plugin-api", () => ({
  listPlugins: vi.fn(async () => ({ plugins: [], pendingCalls: [] })),
  pluginError: vi.fn(() => "Unavailable"),
}));

vi.mock("../api", () => ({
  createMessage: vi.fn(),
  listMessages: vi.fn(),
  listRuns: vi.fn(),
  subscribeToChannelEvents: vi.fn(() => vi.fn()),
}));
const bot: Bot = {
  id: "bot-a",
  name: "Assistant",
  role: "Research",
  status: "idle",
  computerProfile: "none",
  createdAt: "2026-09-05T00:00:00Z",
};
const callbacks = {
  onJoin: vi.fn(async () => undefined),
  onInspectRun: vi.fn(),
  onOpenBot: vi.fn(),
  onFrame: vi.fn(),
  onProgress: vi.fn(),
  onRun: vi.fn(),
};
const channel = (id: string): Channel => ({
  id,
  name: `Channel ${id}`,
  description: "",
  botIds: [bot.id],
  createdAt: bot.createdAt,
});
const message = (channelId: string, content = "Saved message"): Message => ({
  id: `message-${channelId}-${content}`,
  channelId,
  authorType: "human",
  content,
  createdAt: bot.createdAt,
});
const result = (channelId: string): SubmitTaskResult => {
  const run: Run = {
    id: `run-${channelId}`,
    channelId,
    botId: bot.id,
    executionProfile: "none",
    instruction: "sent",
    title: "sent",
    status: "queued",
    createdAt: bot.createdAt,
    updatedAt: bot.createdAt,
  };
  return { message: message(channelId), run };
};
function view(id: string, session = createConversationSession()) {
  return (
    <ChannelWorkspace
      key={id}
      globalHeader
      channel={channel(id)}
      session={session}
      bots={[bot]}
      artifacts={[]}
      progress={[]}
      {...callbacks}
    />
  );
}
async function typeText(container: HTMLElement, value: string) {
  const input = container.querySelector("textarea") as HTMLTextAreaElement;
  await interact(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(
      input,
      value,
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit(container: HTMLElement) {
  await interact(() =>
    container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}
function lastHandlers() {
  const call = vi.mocked(subscribeToChannelEvents).mock.calls.at(-1);
  if (!call) throw new Error("No subscription");
  return call[1];
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listMessages).mockResolvedValue([]);
  vi.mocked(listRuns).mockResolvedValue([]);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ChannelWorkspace continuity", () => {
  it("preserves newer draft after send, switches to an independent channel and restores results on return", async () => {
    const session = createConversationSession();
    const response = deferred<SubmitTaskResult>();
    vi.mocked(createMessage).mockReturnValue(response.promise);
    const first = await renderComponent(view("a", session));
    await typeText(first.container, "first draft");
    await submit(first.container);
    await typeText(first.container, "next draft");
    await first.unmount();
    const second = await renderComponent(view("b", session));
    expect((second.container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
    await typeText(second.container, "B draft");
    await interact(() => response.resolve(result("a")));
    expect(second.container.textContent).not.toContain("Saved message");
    expect((second.container.querySelector("textarea") as HTMLTextAreaElement).value).toBe(
      "B draft",
    );
    expect(callbacks.onRun).not.toHaveBeenCalled();
    await second.unmount();
    const restored = await renderComponent(view("a", session));
    expect((restored.container.querySelector("textarea") as HTMLTextAreaElement).value).toBe(
      "next draft",
    );
    expect(restored.container.textContent).toContain("Saved message");
    expect(vi.mocked(createMessage)).toHaveBeenCalledTimes(1);
    await restored.unmount();
  });
  it("ignores late reads and callbacks after unmount, even when the transport ignores abort", async () => {
    const session = createConversationSession();
    const read = deferred<Message[]>();
    vi.mocked(listMessages).mockReturnValueOnce(read.promise);
    const first = await renderComponent(view("a", session));
    const stale = lastHandlers();
    await first.unmount();
    const next = await renderComponent(view("b", session));
    await interact(() => {
      stale.onMessage(message("a", "stale event"));
      stale.onRun(result("a").run, []);
      read.resolve([message("a", "stale read")]);
    });
    expect(session.channel("a").getSnapshot().messages).toHaveLength(0);
    expect(next.container.textContent).not.toContain("stale");
    expect(callbacks.onRun).not.toHaveBeenCalled();
    await next.unmount();
  });
  it("keeps the send failure visible after a successful reconnect read", async () => {
    vi.mocked(listMessages).mockRejectedValueOnce(new Error("History unavailable"));
    vi.mocked(createMessage).mockRejectedValueOnce(new Error("Send unavailable"));
    const rendered = await renderComponent(view("a"));
    expect(rendered.container.querySelector(".conversation-load-error")?.textContent).toContain(
      "History unavailable",
    );
    await typeText(rendered.container, "keep draft");
    await submit(rendered.container);
    await interact(() => lastHandlers().onReady());
    expect(rendered.container.querySelector(".conversation-load-error")).toBeNull();
    expect(rendered.container.querySelector(".composer-error")?.textContent).toContain(
      "Send unavailable",
    );
    expect((rendered.container.querySelector("textarea") as HTMLTextAreaElement).value).toBe(
      "keep draft",
    );
    await rendered.unmount();
  });
  it("does not treat composition, Shift+Enter or Alt+Enter as submission", async () => {
    const rendered = await renderComponent(view("a"));
    const form = rendered.container.querySelector("form") as HTMLFormElement;
    const request = vi.spyOn(form, "requestSubmit").mockImplementation(() => undefined);
    const input = rendered.container.querySelector("textarea") as HTMLTextAreaElement;
    for (const flags of [
      { isComposing: true },
      { shiftKey: true },
      { altKey: true },
      { keyCode: 229 },
    ]) {
      await interact(() =>
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", bubbles: true, ...flags }),
        ),
      );
    }
    expect(request).not.toHaveBeenCalled();
    await interact(() =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );
    expect(request).toHaveBeenCalledTimes(1);
    await rendered.unmount();
  });
  it("preserves a reading position when new messages arrive and offers an explicit jump", async () => {
    const session = createConversationSession();
    session.channel("a", bot.id).merge([message("a")]);
    const rendered = await renderComponent(view("a", session));
    const log = rendered.container.querySelector('[role="log"]') as HTMLDivElement;
    Object.defineProperties(log, {
      scrollHeight: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 400 },
    });
    await interact(() => {
      log.scrollTop = 140;
      log.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await interact(() => lastHandlers().onMessage(message("a", "new message")));
    expect(log.scrollTop).toBe(140);
    const latest = rendered.container.querySelector(".conversation-latest") as HTMLButtonElement;
    expect(latest).not.toBeNull();
    await interact(() => latest.click());
    expect(session.channel("a").scroll.atBottom).toBe(true);
    expect(log.scrollTop).toBe(1200);
    expect(rendered.container.querySelector(".conversation-latest")).toBeNull();
    await rendered.unmount();
  });
  it("does not save hidden geometry and restores the reading position when settings closes", async () => {
    const observers = new Map<Element, () => void>();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        callback: () => void;
        constructor(callback: () => void) {
          this.callback = callback;
        }
        observe(target: Element) {
          observers.set(target, this.callback);
        }
        disconnect() {}
      },
    );
    const session = createConversationSession();
    session.channel("a", bot.id).merge([message("a")]);
    const rendered = await renderComponent(view("a", session));
    const log = rendered.container.querySelector('[role="log"]') as HTMLDivElement;
    let height = 400;
    Object.defineProperties(log, {
      scrollHeight: { configurable: true, get: () => (height === 0 ? 0 : 1400) },
      clientHeight: { configurable: true, get: () => height },
    });
    await interact(() => observers.get(log)?.());
    await interact(() => {
      log.scrollTop = 170;
      log.dispatchEvent(new Event("scroll"));
    });
    await interact(() => {
      height = 0;
      observers.get(log)?.();
      log.scrollTop = 0;
      log.dispatchEvent(new Event("scroll"));
    });
    await interact(() => lastHandlers().onMessage(message("a", "arrived while hidden")));
    expect(session.channel("a").scroll).toEqual({ top: 170, atBottom: false });
    await interact(() => {
      height = 400;
      observers.get(log)?.();
    });
    expect(log.scrollTop).toBe(170);
    await rendered.unmount();
  });
  it("follows the latest messages through viewport resize without mistaking layout scroll for user intent", async () => {
    const observers = new Map<Element, () => void>();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        callback: () => void;
        constructor(callback: () => void) {
          this.callback = callback;
        }
        observe(target: Element) {
          observers.set(target, this.callback);
        }
        disconnect() {}
      },
    );
    const session = createConversationSession();
    session.channel("a", bot.id).merge([message("a")]);
    const rendered = await renderComponent(view("a", session));
    const log = rendered.container.querySelector('[role="log"]') as HTMLDivElement;
    let width = 900;
    let height = 700;
    let content = 1300;
    let top = 0;
    Object.defineProperties(log, {
      clientWidth: { configurable: true, get: () => width },
      clientHeight: { configurable: true, get: () => height },
      scrollHeight: { configurable: true, get: () => content },
      scrollTop: {
        configurable: true,
        get: () => top,
        set: (value: number) => {
          top = Math.max(0, Math.min(value, content - height));
        },
      },
    });
    await interact(() => observers.get(log)?.());
    expect(log.scrollTop).toBe(600);
    await interact(() => {
      width = 520;
      height = 400;
      content = 1900;
      log.scrollTop = 0;
      log.dispatchEvent(new Event("scroll"));
    });
    expect(session.channel("a").scroll.atBottom).toBe(true);
    await interact(() => observers.get(log)?.());
    expect(log.scrollTop).toBe(1500);
    expect(rendered.container.querySelector(".conversation-latest")).toBeNull();
    await interact(() => {
      log.scrollTop = 170;
      log.dispatchEvent(new Event("scroll"));
    });
    await interact(() => {
      width = 840;
      height = 600;
      content = 1400;
      observers.get(log)?.();
    });
    expect(log.scrollTop).toBe(170);
    expect(session.channel("a").scroll.atBottom).toBe(false);
    expect(rendered.container.querySelector(".conversation-latest")).not.toBeNull();
    await rendered.unmount();
  });
});

describe("ChannelWorkspace recipient and attachment interactions", () => {
  const secondBot: Bot = { ...bot, id: "bot-b", name: "Coder" };
  const outsider: Bot = { ...bot, id: "outsider", name: "Outside" };
  function multi(session = createConversationSession()) {
    return (
      <ChannelWorkspace
        globalHeader
        channel={{ ...channel("a"), botIds: [bot.id, secondBot.id] }}
        session={session}
        bots={[bot, secondBot, outsider]}
        artifacts={[]}
        progress={[]}
        {...callbacks}
      />
    );
  }
  it("chooses only channel members using @ and submits the chosen structured id", async () => {
    vi.mocked(createMessage).mockResolvedValue(result("a"));
    const session = createConversationSession();
    const rendered = await renderComponent(multi(session));
    try {
      await typeText(rendered.container, "Review @");
      const choices = rendered.container.querySelectorAll('[role="option"]');
      expect(choices).toHaveLength(2);
      expect(rendered.container.querySelector('[role="listbox"]')?.textContent).not.toContain(
        "Outside",
      );
      await interact(() => (choices[1] as HTMLButtonElement).click());
      expect(session.channel("a").getSnapshot().draft).toMatchObject({
        text: "Review",
        targetBotId: "bot-b",
      });
      expect(rendered.container.querySelector(".composer-mention")?.textContent).toContain(
        "@Coder",
      );
      expect(rendered.container.querySelector(".message-composer select")).toBeNull();
      await submit(rendered.container);
      expect(createMessage).toHaveBeenCalledWith("a", { content: "Review", botId: "bot-b" });
    } finally {
      await rendered.unmount();
    }
  });
  it("does not send an unresolved @ mention to the previous recipient", async () => {
    const session = createConversationSession();
    session.channel("a", bot.id);
    const rendered = await renderComponent(multi(session));
    try {
      await typeText(rendered.container, "Review @unknown");
      expect(
        rendered.container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled,
      ).toBe(true);
      await submit(rendered.container);
      expect(createMessage).not.toHaveBeenCalled();
      expect(session.channel("a").getSnapshot().draft.text).toBe("Review @unknown");
    } finally {
      await rendered.unmount();
    }
  });
  it("keeps an explicitly removed recipient empty until another Bot is chosen", async () => {
    const session = createConversationSession();
    const rendered = await renderComponent(view("a", session));
    try {
      await interact(() =>
        rendered.container.querySelector<HTMLButtonElement>('[aria-label="移除接收 Bot"]')?.click(),
      );
      expect(session.channel("a").getSnapshot().draft.targetBotId).toBe("");
      expect(rendered.container.querySelector(".composer-mention")).toBeNull();
    } finally {
      await rendered.unmount();
    }
  });
  it("clears a removed member's identity and skills without losing text or attachments", async () => {
    const session = createConversationSession();
    session.channel("a", secondBot.id).edit({
      text: "Unsent work",
      skills: [{ id: "skill-b", name: "Coding", version: "1" }],
      attachments: [{ name: "brief.md", text: "Instructions" }],
    });
    const rendered = await renderComponent(view("a", session));
    try {
      expect(session.channel("a").getSnapshot().draft).toMatchObject({
        targetBotId: "",
        skills: [],
        text: "Unsent work",
        attachments: [{ name: "brief.md", text: "Instructions" }],
      });
      await submit(rendered.container);
      expect(createMessage).not.toHaveBeenCalled();
    } finally {
      await rendered.unmount();
    }
  });
  it("does not select a mention while an IME confirms text", async () => {
    const session = createConversationSession();
    const rendered = await renderComponent(multi(session));
    try {
      await typeText(rendered.container, "Review @");
      const textarea = rendered.container.querySelector("textarea");
      await interact(() =>
        textarea?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", keyCode: 229, bubbles: true }),
        ),
      );
      expect(session.channel("a").getSnapshot().draft.targetBotId).toBe("");
      expect(rendered.container.querySelector('[role="listbox"]')).not.toBeNull();
      expect(createMessage).not.toHaveBeenCalled();
    } finally {
      await rendered.unmount();
    }
  });
  it("blocks a ninth attachment and keeps selected context after transport failure", async () => {
    const session = createConversationSession();
    const attachments = Array.from({ length: 8 }, (_, index) => `${index}.md`).map((name) => ({
      name,
      text: "Review",
    }));
    session.channel("a", bot.id).edit({
      text: "keep draft",
      attachments,
      skills: [{ id: "skill-a", name: "Review", version: "1" }],
    });
    vi.mocked(createMessage).mockRejectedValue(new Error("offline"));
    const rendered = await renderComponent(view("a", session));
    try {
      const input = rendered.container.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) throw new Error("Attachment input missing");
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [new File(["nine"], "nine.md")],
      });
      await interact(() => input.dispatchEvent(new Event("change", { bubbles: true })));
      expect(rendered.container.textContent).toContain("最多添加 8 个附件");
      expect(session.channel("a").getSnapshot().draft.attachments).toEqual(attachments);
      await submit(rendered.container);
      expect(session.channel("a").getSnapshot().draft).toMatchObject({
        attachments,
        skills: [{ id: "skill-a", name: "Review", version: "1" }],
      });
      expect(rendered.container.textContent).toContain("offline");
    } finally {
      await rendered.unmount();
    }
  });
});

describe("ChannelWorkspace delegated identities", () => {
  it("renders sender and recipient independently and attaches output only to its producing Bot", async () => {
    const recipient: Bot = { ...bot, id: "researcher", name: "Researcher" };
    const parent: Run = { ...result("a").run, id: "parent", sourceMessageId: "request" };
    const child: Run = {
      ...parent,
      id: "child",
      botId: recipient.id,
      parentRunId: parent.id,
      rootRunId: parent.id,
      delegatedByBotId: bot.id,
      sourceMessageId: "delegation",
      status: "completed",
    };
    const delegation: Message = {
      ...message("a", "Please verify sources"),
      id: "delegation",
      authorType: "bot",
      authorId: bot.id,
      runId: child.id,
    };
    const answer: Message = {
      ...delegation,
      id: "answer",
      authorId: recipient.id,
      content: "Sources verified",
    };
    vi.mocked(listMessages).mockResolvedValue([delegation, answer]);
    vi.mocked(listRuns).mockResolvedValue([parent, child]);
    const rendered = await renderComponent(
      <ChannelWorkspace
        channel={{ ...channel("a"), botIds: [bot.id, recipient.id] }}
        bots={[bot, recipient]}
        artifacts={[
          {
            id: "report",
            runId: child.id,
            name: "sources.md",
            mediaType: "text/markdown",
            sha256: "a".repeat(64),
            sizeBytes: 10,
            createdAt: bot.createdAt,
          },
        ]}
        progress={[]}
        {...callbacks}
      />,
    );
    try {
      const rows = rendered.container.querySelectorAll(".message-row");
      expect(rows[0]?.querySelector("header strong")?.textContent).toBe(bot.name);
      expect(rows[1]?.querySelector("header strong")?.textContent).toBe(recipient.name);
      expect(rows[0]?.querySelector(".delegation-notice")?.textContent).toContain(recipient.name);
      expect(rows[1]?.querySelector(".delegated-reply-context")?.textContent).toContain(bot.name);
      expect(rows[0]?.querySelector(".message-artifacts")).toBeNull();
      expect(rows[1]?.querySelector(".message-artifacts")?.textContent).toContain("sources.md");
      await interact(() =>
        rows[1]?.querySelector<HTMLButtonElement>(".delegated-reply-context button")?.click(),
      );
      expect(callbacks.onInspectRun).toHaveBeenCalledWith(parent.id);
    } finally {
      await rendered.unmount();
    }
  });
});
