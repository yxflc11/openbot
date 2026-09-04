import { describe, expect, it } from "vitest";
import { publicRunFailure } from "./run-failure.js";

describe("public Run failures", () => {
  it("returns only stable allowlisted messages", () => {
    const failure = publicRunFailure("provider_execution_failed");
    expect(failure).toEqual({
      code: "provider_execution_failed",
      message: "Provider execution failed.",
    });
    expect(JSON.stringify(failure)).not.toContain("token=");
    expect(JSON.stringify(failure)).not.toContain("/Users/");
  });
});
