import { describe, expect, it } from "vitest";
import {
  boundedKnowledgeText,
  reviewKnowledgeProposalSchema,
  validateKnowledgeProposal,
} from "./agent-knowledge.js";

const draft = {
  kind: "procedural",
  title: "Cite evidence",
  content: "Retain a source URL and separate inference from facts.",
};
describe("reviewed Agent knowledge boundaries", () => {
  it("normalizes a bounded proposal but never accepts model-selected authority fields", () => {
    expect(validateKnowledgeProposal({ ...draft, title: "  Cite evidence  " })).toEqual(draft);
    for (const extra of [
      { botId: "other" },
      { ownerReviewed: true },
      { modelUseEnabled: true },
      { sourceRunId: "invented" },
    ])
      expect(() => validateKnowledgeProposal({ ...draft, ...extra })).toThrow();
  });
  it("rejects unknown kinds, oversized text, null bytes and synthetic credential assignments", () => {
    for (const patch of [
      { kind: "secret-reference" },
      { content: "x".repeat(2001) },
      { title: "x\0y" },
      { content: ["password", "=", "fixture-value"].join("") },
    ])
      expect(() => validateKnowledgeProposal({ ...draft, ...patch })).toThrow();
  });
  it("requires explicit review and a deliberate model-use choice for acceptance", () => {
    expect(
      reviewKnowledgeProposalSchema.safeParse({
        decision: "accept",
        ownerReviewed: true,
        title: draft.title,
        content: draft.content,
      }).success,
    ).toBe(false);
    expect(
      reviewKnowledgeProposalSchema.safeParse({ decision: "reject", ownerReviewed: false }).success,
    ).toBe(false);
    expect(
      reviewKnowledgeProposalSchema.safeParse({
        decision: "reject",
        ownerReviewed: true,
        content: "ignored",
      }).success,
    ).toBe(false);
    expect(
      reviewKnowledgeProposalSchema.parse({
        decision: "accept",
        ownerReviewed: true,
        title: draft.title,
        content: draft.content,
        modelUseEnabled: false,
      }),
    ).toMatchObject({ modelUseEnabled: false });
  });
  it("bounds UTF-8 without splitting non-ASCII code points", () => {
    expect(boundedKnowledgeText("中文资料", 7)).toBe("中文");
    expect(boundedKnowledgeText("a😀b", 5)).toBe("a😀");
  });
});
