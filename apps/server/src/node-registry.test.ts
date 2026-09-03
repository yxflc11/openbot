import { describe, expect, it } from "vitest";
import { isEnrollmentTokenValid } from "./node-registry.js";

describe("node enrollment", () => {
  it("accepts only an exact token match", () => {
    expect(isEnrollmentTokenValid("foundation-token", "foundation-token")).toBe(true);
    expect(isEnrollmentTokenValid("wrong-token", "foundation-token")).toBe(false);
    expect(isEnrollmentTokenValid("short", "foundation-token")).toBe(false);
  });
});
