import type { Message, Run, SubmitTaskResult } from "@openbot/domain";
import { describe, expect, it, vi } from "vitest";
import { createConversationSession } from "./conversation-session";
import { deferred } from "./test/render-component";

function result(channelId = "a"): SubmitTaskResult {
  const message: Message = {
    id: `message-${channelId}`,
    channelId,
    authorType: "human",
    content: "sent",
    createdAt: "2026-09-05T00:00:00Z",
  };
  const run: Run = {
    id: `run-${channelId}`,
    channelId,
    botId: "bot-a",
    title: "sent",
    status: "queued",
    executionProfile: "none",
    instruction: "sent",
    createdAt: message.createdAt,
    updatedAt: message.createdAt,
  };
  return { message, run };
}

describe("workspace conversation session", () => {
  it("retains newer text, target and reply when an older submission settles", async () => {
    const session = createConversationSession();
    const a = session.channel("a", "bot-a");
    a.edit({ text: "first", replyTo: result().message });
    const response = deferred<SubmitTaskResult>();
    const submit = vi.fn(() => response.promise);
    const sending = a.send(submit);
    a.edit({ text: "second", targetBotId: "bot-b", replyTo: undefined });
    response.resolve(result());
    await sending;
    expect(submit).toHaveBeenCalledWith({
      content: "first",
      botId: "bot-a",
      replyToMessageId: "message-a",
    });
    expect(a.getSnapshot().draft).toMatchObject({
      text: "second",
      targetBotId: "bot-b",
      replyTo: undefined,
    });
    expect(a.getSnapshot().messages).toHaveLength(1);
  });
  it("clears an unchanged sent draft and does not clear edited-then-restored text", async () => {
    const a = createConversationSession().channel("a", "bot-a");
    a.edit({ text: "first", replyTo: result().message });
    await a.send(async () => result());
    expect(a.getSnapshot().draft).toMatchObject({ text: "", replyTo: undefined });
    a.edit({ text: "again" });
    const response = deferred<SubmitTaskResult>();
    const sending = a.send(() => response.promise);
    a.edit({ text: "changed" });
    a.edit({ text: "again" });
    response.resolve(result());
    await sending;
    expect(a.getSnapshot().draft.text).toBe("again");
  });
  it("deduplicates a pending send across subscriptions/remounts and isolates another channel", async () => {
    const session = createConversationSession();
    const a = session.channel("a", "bot-a");
    a.edit({ text: "first" });
    const response = deferred<SubmitTaskResult>();
    const submit = vi.fn(() => response.promise);
    const sending = a.send(submit);
    const release = a.subscribe(vi.fn());
    release();
    const b = session.channel("b", "bot-b");
    b.edit({ text: "other channel" });
    expect(session.channel("a").send(submit)).toBe(sending);
    response.resolve(result());
    await sending;
    expect(submit).toHaveBeenCalledTimes(1);
    expect(session.channel("a").getSnapshot().messages).toHaveLength(1);
    expect(b.getSnapshot().messages).toHaveLength(0);
    expect(b.getSnapshot().draft.text).toBe("other channel");
  });
  it("keeps send failure through successful reads and preserves the failed draft", async () => {
    const a = createConversationSession().channel("a", "bot-a");
    a.edit({ text: "keep this" });
    await a.send(async () => {
      throw new Error("Connection closed");
    });
    a.loaded("Read failed");
    a.loaded();
    expect(a.getSnapshot()).toMatchObject({ loading: false, loadError: undefined, sending: false });
    expect(a.getSnapshot().sendError).toContain("Connection closed");
    expect(a.getSnapshot().draft.text).toBe("keep this");
  });
  it("bounds clean history while protecting dirty drafts, and shows a recoverable capacity notice", () => {
    const session = createConversationSession();
    for (let i = 0; i < 32; i++) session.channel(`c${i}`, "bot-a").edit({ text: `draft ${i}` });
    const overflow = session.channel("overflow");
    expect(overflow.getSnapshot().capacityError).toContain("32");
    overflow.edit({ text: "must not be lost" });
    expect(overflow.getSnapshot().draft.text).toBe("");
    expect(session.channel("c0").getSnapshot().draft.text).toBe("draft 0");
    session.channel("c0").edit({ text: "" });
    expect(session.channel("overflow").getSnapshot().capacityError).toBeUndefined();
    expect(session.channel("c31").getSnapshot().draft.text).toBe("draft 31");
  });
  it("disposes private content and prevents a queued submission after logout", async () => {
    const session = createConversationSession();
    const a = session.channel("a", "bot-a");
    a.edit({ text: "private" });
    a.merge([result().message], [result().run]);
    const submit = vi.fn(async () => result());
    const sending = a.send(submit);
    session.dispose();
    await sending;
    expect(submit).not.toHaveBeenCalled();
    expect(a.getSnapshot().draft.text).toBe("");
    expect(a.getSnapshot().messages).toEqual([]);
  });
  it("discards an already submitted response when the workspace has ended", async () => {
    const session = createConversationSession();
    const a = session.channel("a", "bot-a");
    a.edit({ text: "private" });
    const response = deferred<SubmitTaskResult>();
    const sending = a.send(() => response.promise);
    await Promise.resolve();
    session.dispose();
    response.resolve(result());
    expect(await sending).toBeUndefined();
    expect(a.getSnapshot().messages).toEqual([]);
  });
  it("rejects a mismatched Server response and bounds transcript caches", async () => {
    const a = createConversationSession().channel("a", "bot-a");
    a.edit({ text: "first" });
    await a.send(async () => result("b"));
    expect(a.getSnapshot().messages).toHaveLength(0);
    expect(a.getSnapshot().sendError).toContain("不匹配");
    a.merge(
      Array.from({ length: 250 }, (_, index) => ({
        ...result().message,
        id: `m${index}`,
        createdAt: String(index).padStart(4, "0"),
      })),
    );
    expect(a.getSnapshot().messages).toHaveLength(200);
  });
});
