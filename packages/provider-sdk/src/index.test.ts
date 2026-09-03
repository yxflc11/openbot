import { describe, expect, it } from "vitest";
import type { ComputerProvider } from "./index.js";
import { assertProviderDeclarations, inspectProviderDeclaration } from "./index.js";

const provider = (overrides: Partial<ComputerProvider> = {}): ComputerProvider => ({
  id: "browser-driver",
  displayName: "Browser driver",
  platforms: ["linux", "windows", "macos"],
  capabilities: ["browser", "screenshot"],
  capabilityManifest: [
    { id: "browser.observe", version: 1, providerId: "browser-driver", constraints: {} },
    { id: "screen.capture", version: 1, providerId: "browser-driver", constraints: {} },
  ],
  ...overrides,
});

describe("Provider declaration conformance", () => {
  it("separates a conformant declaration from runtime execution support", () => {
    expect(inspectProviderDeclaration(provider())).toEqual({
      providerId: "browser-driver",
      conformant: true,
      executionStatus: "declaration-only",
      issues: [],
    });
    expect(
      inspectProviderDeclaration(
        provider({
          execute: async () => ({ ok: true, summary: "done", artifacts: [] }),
        }),
      ).executionStatus,
    ).toBe("executable");
  });

  it("reports invalid and internally inconsistent declarations", () => {
    const report = inspectProviderDeclaration(
      provider({
        id: "Browser Driver",
        displayName: " ",
        platforms: ["unknown", "unknown"],
        capabilities: ["browser", "browser"],
        capabilityManifest: [
          { id: "browser.observe", version: 1, providerId: "other", constraints: {} },
          { id: "browser.observe", version: 1, providerId: "other", constraints: {} },
        ],
      }),
    );

    expect(report.conformant).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "provider-id-invalid",
      "display-name-missing",
      "platform-duplicate",
      "platform-unknown",
      "legacy-capability-duplicate",
      "capability-provider-mismatch",
      "capability-provider-mismatch",
      "capability-duplicate",
    ]);
  });

  it("fails closed before a Worker Host can advertise an invalid declaration", () => {
    expect(() =>
      assertProviderDeclarations([
        provider({
          capabilityManifest: [],
          execute: async () => ({ ok: true, summary: "", artifacts: [] }),
        }),
      ]),
    ).toThrow("browser-driver:capability-manifest-empty");
  });
});
