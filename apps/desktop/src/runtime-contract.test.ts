import { describe, expect, it } from "vitest";
import { createDesktopRuntimeInfo } from "./runtime-contract.js";

describe("Desktop runtime contract", () => {
  it("returns a frozen, content-only renderer value", () => {
    const info = createDesktopRuntimeInfo("darwin", "44.2.0");

    expect(info).toEqual({ kind: "desktop", platform: "darwin", shellVersion: "44.2.0" });
    expect(Object.isFrozen(info)).toBe(true);
    expect(Object.values(info).every((value) => typeof value === "string")).toBe(true);
  });

  it.each([
    ["../../darwin", "44.2.0"],
    ["darwin", "latest"],
    ["", "44.2.0"],
  ])("rejects malformed runtime metadata", (platform, version) => {
    expect(() => createDesktopRuntimeInfo(platform, version)).toThrow();
  });
});
