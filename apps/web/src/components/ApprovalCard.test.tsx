// @vitest-environment jsdom

import type { Approval, Bot, Channel } from "@openbot/domain";
import { describe, expect, it, vi } from "vitest";
import { deferred, interact, renderComponent } from "../test/render-component";
import { ApprovalCard } from "./ApprovalCard";

const approval: Approval = {
  id: "approval-1",
  runId: "run-1",
  channelId: "channel-1",
  botId: "bot-1",
  nodeId: "node-1",
  action: "form.submit",
  target: "https://example.test/form#signup",
  summary: "提交注册表单",
  risk: "write",
  targetFingerprint: "0".repeat(64),
  beforeState: { fields: 3 },
  status: "pending",
  expiresAt: "2999-01-01T00:00:00.000Z",
  createdAt: "2026-09-04T00:00:00.000Z",
};

const bot: Bot = {
  id: approval.botId,
  name: "Ops",
  role: "Browser operations",
  status: "idle",
  computerProfile: "docker-linux",
  createdAt: "2026-09-04T00:00:00.000Z",
};

const channel: Channel = {
  id: approval.channelId,
  name: "Operations",
  description: "Daily operations",
  botIds: [bot.id],
  createdAt: "2026-09-04T00:00:00.000Z",
};

describe("ApprovalCard", () => {
  it("renders review context and suppresses duplicate actions while approval is pending", async () => {
    const pending = deferred();
    const onDecide = vi.fn(() => pending.promise);
    const rendered = await renderComponent(
      <ApprovalCard approval={approval} bot={bot} channel={channel} onDecide={onDecide} />,
    );

    try {
      expect(rendered.container.querySelector("article")?.classList).toContain("risk-write");
      expect(rendered.container.textContent).toContain("提交注册表单");
      expect(rendered.container.textContent).toContain("Ops · Operations");
      expect(rendered.container.querySelector("time")?.dateTime).toBe(approval.expiresAt);

      const approve = getButton(rendered.container, "提交这张表单");
      const reject = getButton(rendered.container, "拒绝");
      await interact(() => approve.click());

      expect(onDecide).toHaveBeenCalledTimes(1);
      expect(onDecide).toHaveBeenCalledWith(approval.id, "approve");
      expect(approve.disabled).toBe(true);
      expect(reject.disabled).toBe(true);
      expect(approve.textContent).toBe("批准中…");

      await interact(() => reject.click());
      expect(onDecide).toHaveBeenCalledTimes(1);

      pending.resolve();
      await pending.promise;
    } finally {
      await rendered.unmount();
    }
  });

  it("announces a decision error and re-enables both choices for retry", async () => {
    const onDecide = vi.fn().mockRejectedValueOnce(new Error("审批已过期，请刷新。"));
    const rendered = await renderComponent(
      <ApprovalCard approval={approval} bot={bot} channel={channel} onDecide={onDecide} />,
    );

    try {
      await interact(() => getButton(rendered.container, "拒绝").click());

      const alert = rendered.container.querySelector<HTMLElement>("[role='alert']");
      expect(alert?.textContent).toBe("审批已过期，请刷新。");
      expect(getButton(rendered.container, "拒绝").disabled).toBe(false);
      expect(getButton(rendered.container, "提交这张表单").disabled).toBe(false);
    } finally {
      await rendered.unmount();
    }
  });
});

function getButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label,
  );
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`);
  return button;
}
