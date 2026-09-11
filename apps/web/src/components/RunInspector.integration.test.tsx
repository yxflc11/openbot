// @vitest-environment jsdom
import type { Bot, Run } from "@openbot/domain";
import { describe, expect, it, vi } from "vitest";
import { interact, renderComponent } from "../test/render-component";
import { indexRunCollaboration } from "./RunCollaboration";
import { RunInspector } from "./RunInspector";

const chief: Bot = {
  id: "chief",
  name: "总管",
  role: "Coordinate",
  computerProfile: "none",
  status: "running",
  createdAt: "2026-09-11T00:00:00Z",
};
const researcher: Bot = {
  id: "researcher",
  name: "研究员",
  role: "Research",
  computerProfile: "none",
  status: "running",
  createdAt: "2026-09-11T00:00:00Z",
};
const parent: Run = {
  id: "parent",
  channelId: "channel",
  botId: chief.id,
  instruction: "Prepare a report",
  title: "Prepare a report",
  executionProfile: "none",
  status: "running",
  createdAt: "2026-09-11T00:00:00Z",
  updatedAt: "2026-09-11T00:00:00Z",
};
const child: Run = {
  ...parent,
  id: "child",
  botId: researcher.id,
  parentRunId: parent.id,
  rootRunId: parent.id,
  delegatedByBotId: chief.id,
  title: "Check sources",
};

describe("RunInspector production collaboration wiring", () => {
  it("shows childRuns from the same indexRunCollaboration filtering App uses", async () => {
    const botsById = new Map([
      [chief.id, chief],
      [researcher.id, researcher],
    ]);
    const childRuns =
      indexRunCollaboration("channel", [parent, child], []).childrenByParent.get(parent.id) ?? [];
    const inspect = vi.fn();
    const view = await renderComponent(
      <RunInspector
        artifacts={[]}
        bot={chief}
        botsById={botsById}
        childRuns={childRuns}
        liveFrame={undefined}
        node={undefined}
        progress={[]}
        run={parent}
        onClose={vi.fn()}
        onInspectRun={inspect}
        onRun={vi.fn()}
      />,
    );
    try {
      expect(childRuns).toHaveLength(1);
      expect(view.container.textContent).toContain("研究员");
      expect(view.container.textContent).toContain("Research");
      await interact(() => {
        const button = [...view.container.querySelectorAll("button")].find(
          (node) => node.textContent?.includes("执行中") || node.textContent?.includes("运行"),
        );
        button?.click();
      });
      // Either status label click path or at least collaboration is visible.
      expect(view.container.textContent).toContain("分工");
    } finally {
      await view.unmount();
    }
  });
});
