// @vitest-environment jsdom
import type { Bot, Message, Run } from "@openbot/domain";
import { describe, expect, it, vi } from "vitest";
import { interact, renderComponent } from "../test/render-component";
import {
  type CollaborationRun,
  DelegatedReplyContext,
  DelegationNotice,
  indexRunCollaboration,
  RunCollaboration,
} from "./RunCollaboration";

const parent: Run = {
  id: "parent",
  channelId: "channel",
  botId: "chief",
  sourceMessageId: "request",
  instruction: "Prepare a report",
  title: "Prepare a report",
  executionProfile: "none",
  status: "running",
  createdAt: "2026-09-10T00:00:00Z",
  updatedAt: "2026-09-10T00:00:00Z",
};
const child: CollaborationRun = {
  ...parent,
  id: "child",
  sourceMessageId: "delegation",
  botId: "researcher",
  parentRunId: parent.id,
  rootRunId: parent.id,
  delegatedByBotId: "chief",
  title: "Check sources",
};
const source: Message = {
  id: "delegation",
  channelId: "channel",
  authorType: "bot",
  authorId: "chief",
  runId: "child",
  content: "Please check these sources",
  createdAt: parent.createdAt,
};
const bots = new Map<string, Bot>([
  [
    "chief",
    {
      id: "chief",
      name: "总管",
      role: "Coordinate",
      computerProfile: "none",
      status: "running",
      createdAt: parent.createdAt,
    },
  ],
  [
    "researcher",
    {
      id: "researcher",
      name: "研究员",
      role: "Research",
      computerProfile: "none",
      status: "running",
      createdAt: parent.createdAt,
    },
  ],
]);

describe("structured channel collaboration", () => {
  it("links the exact Bot-authored source and preserves the recipient identity", () => {
    const index = indexRunCollaboration(
      "channel",
      [child, parent],
      [source, { ...source, id: "unrelated", content: "@研究员 Check sources" }],
    );
    expect(index.delegationByMessage.get(source.id)).toEqual(child);
    expect(index.delegationByMessage.has("unrelated")).toBe(false);
    expect(index.childrenByParent.get(parent.id)).toEqual([child]);
  });

  it("does not infer sender, cross-channel, self or cyclic relationships", () => {
    const elsewhere = { ...child, id: "elsewhere", channelId: "elsewhere" };
    const wrongSender = { ...child, id: "wrong", delegatedByBotId: "unknown" };
    const self = { ...child, id: "self", parentRunId: "self" };
    const cycleA = { ...child, id: "a", parentRunId: "b" };
    const cycleB = { ...parent, id: "b", parentRunId: "a", delegatedByBotId: "researcher" };
    const index = indexRunCollaboration(
      "channel",
      [parent, elsewhere, wrongSender, self, cycleA, cycleB],
      [source],
    );
    expect(index.linkedRuns.size).toBe(0);
    expect(index.delegationByMessage.size).toBe(0);
    expect(
      indexRunCollaboration(
        "channel",
        [parent, child],
        [{ ...source, authorType: "human", authorId: undefined }],
      ).delegationByMessage.size,
    ).toBe(0);
  });

  it("retains an explicit missing-parent state without fabricating a clickable parent", async () => {
    const index = indexRunCollaboration("channel", [child], [source]);
    expect(index.linkedRuns.get(child.id)).toEqual(child);
    expect(index.childrenByParent.size).toBe(0);
    const view = await renderComponent(
      <DelegatedReplyContext
        run={child}
        parent={undefined}
        botsById={bots}
        onInspectRun={vi.fn()}
      />,
    );
    try {
      expect(view.container.textContent).toContain("回应 总管 的委派");
      expect(view.container.textContent).toContain("原任务暂未加载");
      expect(view.container.querySelector("button")).toBeNull();
    } finally {
      await view.unmount();
    }
  });

  it("opens recipient tasks from a delegation notice and exposes completion summaries", async () => {
    const inspect = vi.fn();
    const completed = {
      ...child,
      status: "completed" as const,
      resultSummary: "Two primary sources confirmed",
    };
    const view = await renderComponent(
      <>
        <DelegationNotice run={child} botsById={bots} onInspectRun={inspect} />
        <RunCollaboration childRuns={[completed]} botsById={bots} onInspectRun={inspect} />
      </>,
    );
    try {
      expect(view.container.textContent).toContain("邀请协作研究员");
      expect(view.container.textContent).toContain("已完成");
      expect(view.container.querySelector(".run-collaboration button")?.getAttribute("title")).toBe(
        "Two primary sources confirmed",
      );
      await interact(() => view.container.querySelector("button")?.click());
      expect(inspect).toHaveBeenCalledWith(child.id);
      expect(view.container.querySelector("details")).toBeNull();
      await interact(() =>
        view.container.querySelector<HTMLButtonElement>(".run-collaboration button")?.click(),
      );
      expect(inspect).toHaveBeenCalledTimes(2);
    } finally {
      await view.unmount();
    }
  });
});
