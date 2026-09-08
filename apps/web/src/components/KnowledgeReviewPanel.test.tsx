// @vitest-environment jsdom
import type { KnowledgeProposal } from "@openbot/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getKnowledgeProposals, reviewKnowledgeProposal } from "../api";
import { deferred, interact, renderComponent } from "../test/render-component";
import { KnowledgeProposalReview, KnowledgeReviewPanel } from "./KnowledgeReviewPanel";

vi.mock("../api", () => ({ getKnowledgeProposals: vi.fn(), reviewKnowledgeProposal: vi.fn() }));
const proposal: KnowledgeProposal = {
  id: "proposal",
  botId: "bot",
  sourceRunId: "source-run",
  kind: "procedural",
  title: "Retain evidence",
  content: "Label inference and retain source URLs.",
  createdAt: "2026-09-08T00:00:00Z",
};
beforeEach(() => vi.clearAllMocks());
describe("Owner knowledge review", () => {
  it("shows full proposal and provenance with model use off until deliberately selected", async () => {
    const onReviewed = vi.fn(async () => {});
    const pending = deferred<{ proposalId: string; decision: string; memoryId: string | null }>();
    vi.mocked(reviewKnowledgeProposal).mockReturnValue(pending.promise);
    const view = await renderComponent(
      <KnowledgeProposalReview proposal={proposal} onReviewed={onReviewed} />,
    );
    try {
      expect(view.container.textContent).toContain("source-run");
      expect(view.container.querySelector("textarea")?.value).toBe(proposal.content);
      const checkbox = view.container.querySelector<HTMLInputElement>('input[type="checkbox"]');
      expect(checkbox?.checked).toBe(false);
      await interact(() => checkbox?.click());
      const submit = view.container.querySelector<HTMLButtonElement>('button[type="submit"]');
      await interact(() => submit?.click());
      expect(reviewKnowledgeProposal).toHaveBeenCalledExactlyOnceWith("bot", "proposal", {
        decision: "accept",
        ownerReviewed: true,
        title: proposal.title,
        content: proposal.content,
        modelUseEnabled: true,
      });
      expect(submit?.disabled).toBe(true);
      expect(onReviewed).not.toHaveBeenCalled();
      await interact(() =>
        pending.resolve({ proposalId: "proposal", decision: "accept", memoryId: "memory" }),
      );
      expect(onReviewed).toHaveBeenCalledOnce();
    } finally {
      await view.unmount();
    }
  });
  it("sends no candidate content with rejection and reports uncertain results without automatic retry", async () => {
    vi.mocked(reviewKnowledgeProposal).mockRejectedValue(new Error("PRIVATE RESPONSE"));
    const view = await renderComponent(
      <KnowledgeProposalReview proposal={proposal} onReviewed={async () => {}} />,
    );
    try {
      const reject = [...view.container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("拒绝"),
      );
      await interact(() => reject?.click());
      expect(reviewKnowledgeProposal).toHaveBeenCalledExactlyOnceWith("bot", "proposal", {
        decision: "reject",
        ownerReviewed: true,
      });
      expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("刷新");
      expect(view.container.textContent).not.toContain("PRIVATE");
    } finally {
      await view.unmount();
    }
  });
  it("provides a visible refresh path and does not imply empty data after a failed read", async () => {
    vi.mocked(getKnowledgeProposals).mockRejectedValue(new Error("unavailable"));
    const view = await renderComponent(
      <KnowledgeReviewPanel botId="bot" onChanged={async () => {}} />,
    );
    try {
      expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("无法读取");
      expect(view.container.textContent).not.toContain("没有待审阅");
      vi.mocked(getKnowledgeProposals).mockResolvedValue([]);
      await interact(() => view.container.querySelector("button")?.click());
      expect(view.container.textContent).toContain("没有待审阅");
    } finally {
      await view.unmount();
    }
  });
});
