import { describe, expect, it } from "vitest";
import { detectWorkerHost, normalizeArchitecture, normalizePlatform } from "./host.js";

describe("Worker Host identity", () => {
  it("normalizes Node.js desktop platforms without treating Windows as Linux", () => {
    expect(normalizePlatform("darwin")).toBe("macos");
    expect(normalizePlatform("win32")).toBe("windows");
    expect(normalizePlatform("linux")).toBe("linux");
    expect(normalizePlatform("aix")).toBe("unknown");
  });

  it("normalizes common CPU architectures", () => {
    expect(normalizeArchitecture("x64")).toBe("x64");
    expect(normalizeArchitecture("arm64")).toBe("arm64");
    expect(normalizeArchitecture("arm")).toBe("armv7");
    expect(normalizeArchitecture("ia32")).toBe("unknown");
  });

  it("reports honest development trust until per-Node enrollment exists", () => {
    expect(
      detectWorkerHost({ platform: "win32", architecture: "arm64", osVersion: "10.0.26100" }),
    ).toEqual({
      platform: "windows",
      osVersion: "10.0.26100",
      architecture: "arm64",
      deviceClass: "desktop",
      isolation: "unknown",
      trustTier: "development",
    });
  });
});
