// @vitest-environment jsdom

import type { Approval, ExecutionNode, Run, WorkspaceSnapshot } from "@openbot/domain";
import { describe, expect, it, vi } from "vitest";
import { interact, renderComponent } from "../test/render-component";
import { ContextRail } from "./ContextRail";

function workspace(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return {
    channels: [],
    bots: [],
    nodes: [],
    runs: [],
    approvals: [],
    artifacts: [],
    progress: [],
    counts: { channels: 0, bots: 0, connectedNodes: 0, activeRuns: 0 },
    ...overrides,
  };
}

function run(id: string, status: Run["status"], updatedAt = "2026-09-05T01:00:00Z"): Run {
  return {
    id,
    channelId: "channel-1",
    botId: "bot-1",
    executionProfile: "docker-linux",
    instruction: `Task ${id}`,
    title: `Task ${id}`,
    status,
    createdAt: "2026-09-05T00:00:00Z",
    updatedAt,
  };
}

describe("ContextRail", () => {
  it("distinguishes absent token usage from observed zero task records", async () => {
    const rendered = await renderComponent(
      <ContextRail
        realtimeState="live"
        workspace={workspace()}
        onDecideApproval={vi.fn()}
        onInspectRun={vi.fn()}
      />,
    );
    try {
      const tokens = rendered.container.querySelector('[aria-label="Token 用量"]');
      expect(tokens?.textContent).toContain("暂无用量记录");
      expect(tokens?.textContent).not.toContain("0");
      expect(tokens?.querySelectorAll('dd [aria-label="暂无数据"]')).toHaveLength(2);
      expect(Array.from(tokens?.querySelectorAll("dd") ?? [], (item) => item.textContent)).toEqual([
        "—",
        "—",
      ]);
      expect(metric(rendered.container, "进行中")).toBe("0");
      expect(metric(rendered.container, "已完成")).toBe("0");
      expect(metric(rendered.container, "记录数")).toBe("0");
      expect(rendered.container.textContent).toContain("尚未连接工作电脑");
      expect(rendered.container.textContent).toContain("已同步");
      expect(rendered.container.textContent).not.toContain("节省");
    } finally {
      await rendered.unmount();
    }
  });

  it("counts the recent snapshot without treating failures or cancellations as completion", async () => {
    const runs = [
      run("queued", "queued"),
      run("waiting", "waiting_approval"),
      run("blocked", "blocked"),
      run("completed", "completed", "2026-09-05T02:00:00Z"),
      run("failed", "failed", "2026-09-05T04:00:00Z"),
      run("cancelled", "cancelled", "2026-09-05T03:00:00Z"),
    ];
    const orderBefore = runs.map((item) => item.id);
    const onInspectRun = vi.fn();
    const rendered = await renderComponent(
      <ContextRail
        realtimeState="retrying"
        workspace={workspace({ runs })}
        onDecideApproval={vi.fn()}
        onInspectRun={onInspectRun}
      />,
    );
    try {
      expect(metric(rendered.container, "进行中")).toBe("3");
      expect(metric(rendered.container, "已完成")).toBe("1");
      expect(metric(rendered.container, "记录数")).toBe("6");
      expect(rendered.container.textContent).toContain("最近任务6 条记录");
      expect(rendered.container.textContent).toContain("重新连接中");
      const results = rendered.container.querySelector('[aria-label="最近结果"]');
      expect(
        Array.from(results?.querySelectorAll("button") ?? [], (item) => item.ariaLabel),
      ).toEqual(["查看任务：Task failed", "查看任务：Task cancelled", "查看任务：Task completed"]);
      await interact(() => getButton(rendered.container, "查看任务：Task cancelled").click());
      expect(onInspectRun).toHaveBeenCalledWith("cancelled");
      await interact(() => getButton(rendered.container, "查看任务：Task queued").click());
      expect(onInspectRun).toHaveBeenCalledWith("queued");
      expect(runs.map((item) => item.id)).toEqual(orderBefore);
    } finally {
      await rendered.unmount();
    }
  });

  it("preserves pending approval actions and reports connected computer capacity", async () => {
    const approval: Approval = {
      id: "approval-1",
      runId: "run-1",
      channelId: "channel-1",
      botId: "bot-1",
      nodeId: "node-1",
      action: "form.submit",
      target: "https://example.test/form",
      summary: "提交登记表",
      risk: "write",
      targetFingerprint: "0".repeat(64),
      beforeState: {},
      status: "pending",
      expiresAt: "2999-01-01T00:00:00Z",
      createdAt: "2026-09-05T00:00:00Z",
    };
    const node: ExecutionNode = {
      id: "node-1",
      name: "Design Mac",
      platform: "macos",
      osVersion: "26",
      architecture: "arm64",
      deviceClass: "server",
      isolation: "container",
      trustTier: "dedicated",
      capabilities: [],
      capabilityManifest: [],
      activeRunIds: ["run-1"],
      maxConcurrentRuns: 2,
      connectedAt: "2026-09-05T00:00:00Z",
      lastSeenAt: "2026-09-05T01:00:00Z",
    };
    const onDecideApproval = vi.fn(async () => undefined);
    const rendered = await renderComponent(
      <ContextRail
        realtimeState="live"
        workspace={workspace({
          nodes: [node],
          approvals: [approval, { ...approval, id: "approved-2", status: "approved" }],
        })}
        onDecideApproval={onDecideApproval}
        onInspectRun={vi.fn()}
      />,
    );
    try {
      expect(rendered.container.querySelectorAll(".approval-card")).toHaveLength(1);
      expect(rendered.container.textContent).toContain("工作电脑1 台在线");
      expect(rendered.container.textContent).toContain("Design Mac");
      expect(rendered.container.textContent).toContain("macos · 1/2 任务");
      const reject = Array.from(rendered.container.querySelectorAll("button")).find(
        (button) => button.textContent === "拒绝",
      );
      if (reject === undefined) throw new Error("Approval rejection action is missing");
      await interact(() => reject.click());
      expect(onDecideApproval).toHaveBeenCalledWith("approval-1", "reject");
    } finally {
      await rendered.unmount();
    }
  });
});

function metric(container: HTMLElement, label: string): string | null {
  const term = Array.from(container.querySelectorAll("dt")).find(
    (item) => item.textContent === label,
  );
  return term?.nextElementSibling?.textContent ?? null;
}

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.ariaLabel === label,
  );
  if (button === undefined) throw new Error(`Button missing: ${label}`);
  return button;
}
