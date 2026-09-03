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
