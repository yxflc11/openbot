import { describe, expect, it } from "vitest";
import { scanSensitiveText } from "./sensitive-content.js";

describe("sensitive text scanner", () => {
  it("reuses the same credential checks for durable and portable Employee text", () => {
    expect(scanSensitiveText("api_key=super-secret-value", "content", { portable: false })).toEqual(
      [expect.objectContaining({ code: "credential-like-content", location: "content" })],
    );
    expect(scanSensitiveText("Bearer abcdefghijklmnop", "content", { portable: false })).toEqual([
      expect.objectContaining({ code: "credential-like-content", location: "content" }),
    ]);
  });

  it.each([
    ["AWS", ["AKIA", "A".repeat(16)].join("")],
    ["GitHub", ["ghp_", "a".repeat(24)].join("")],
    ["GitLab", ["glpat-", "a".repeat(24)].join("")],
    ["npm", ["npm_", "a".repeat(36)].join("")],
    ["Stripe", ["sk_live_", "a".repeat(24)].join("")],
    ["OpenAI", ["sk-proj-", "a".repeat(24)].join("")],
    ["Google", ["AIza", "a".repeat(35)].join("")],
    ["Slack", ["xoxb-", "a".repeat(24)].join("")],
  ])("rejects a high-confidence %s credential prefix", (_provider, value) => {
    expect(scanSensitiveText(value, "content", { portable: false })).toEqual([
      expect.objectContaining({ code: "credential-like-content" }),
    ]);
  });

  it("rejects private-key markers and portable Windows home paths", () => {
    expect(
      scanSensitiveText("-----BEGIN PRIVATE KEY-----", "content", { portable: false }),
    ).toEqual([expect.objectContaining({ code: "private-key-content" })]);
    expect(
      scanSensitiveText("C:\\Users\\alice\\report.md", "content", { portable: true }),
    ).toEqual([expect.objectContaining({ code: "local-path-content" })]);
  });

  it("allows local paths in local-only memory but rejects them in portable fields", () => {
    expect(
      scanSensitiveText("Read /Users/alice/report.md", "content", { portable: false }),
    ).toEqual([]);
    expect(
      scanSensitiveText("Read /Users/alice/report.md", "employee.role", { portable: true }),
    ).toEqual([expect.objectContaining({ code: "local-path-content", location: "employee.role" })]);
  });

  it("does not reject an opaque vault reference", () => {
    expect(scanSensitiveText("vault://operations/email", "content", { portable: false })).toEqual(
      [],
    );
  });
});
