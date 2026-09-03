import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "./index.js";

describe("evaluatePolicy", () => {
  it("fails closed when no rule matches", () => {
    expect(evaluatePolicy({ action: "email.send", target: "user@example.test" }, [])).toEqual({
      effect: "deny",
      ruleId: "default-deny",
      reason: "No policy rule granted this action.",
    });
  });

  it("requires approval for configured side effects", () => {
    expect(
      evaluatePolicy({ action: "form.submit", target: "https://example.test/form" }, [
        { id: "submit-review", action: "form.submit", effect: "require_approval" },
      ]).effect,
    ).toBe("require_approval");
  });
});
