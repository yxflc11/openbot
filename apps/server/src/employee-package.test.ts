import type { EmployeeProfile } from "@openbot/domain";
import { employeeTemplatePackageSchema } from "@openbot/protocol";
import { describe, expect, it } from "vitest";
import {
  buildEmployeeTemplate,
  inspectEmployeeTemplate,
  serializeEmployeeTemplate,
  verifyEmployeeTemplateChecksum,
} from "./employee-package.js";

const timestamp = "2026-09-04T00:00:00.000Z";
const packageId = "00000000-0000-4000-8000-000000000099";

describe("employee template package", () => {
  it("exports a new-identity template without memory, history, evidence ids, or authority", () => {
    const result = buildEmployeeTemplate(createProfile(), { generatedAt: timestamp, packageId });
    const parsed = employeeTemplatePackageSchema.parse(result.document);
    const serialized = serializeEmployeeTemplate(parsed);

    expect(parsed.payload.skills).toEqual([
      expect.objectContaining({ slug: "browse-web", dependencySlugs: [] }),
    ]);
    expect(parsed.payload.skills).toHaveLength(1);
    expect(parsed.payload.portability).toEqual({
      identity: "new-on-import",
      authority: "none",
      memories: "none",
      importedSkillState: "disabled-pending-review",
    });
    expect(parsed.payload.signature.status).toBe("unsigned");
    expect(result.preview).toMatchObject({
      blocked: false,
      employeeName: "Ops",
      hostAuthority: "none",
      identityOnImport: "new",
      includedMemoryCount: 0,
      verifiedSkillCount: 1,
    });
    expect(serialized).not.toContain("source-bot-id");
    expect(serialized).not.toContain("private-memory");
    expect(serialized).not.toContain("approval-id");
    expect(serialized).not.toContain("skill-evidence-id");
    expect(verifyEmployeeTemplateChecksum(parsed)).toBe(true);
  });

  it("detects secret-like free text and blocks export before download", () => {
    const profile = createProfile();
    profile.employee.role = "Use api_key=super-secret-value for operations";

    const result = buildEmployeeTemplate(profile, { generatedAt: timestamp, packageId });

    expect(result.preview.blocked).toBe(true);
    expect(result.preview.findings).toEqual([
      expect.objectContaining({
        code: "credential-like-content",
        location: "employee.role",
      }),
    ]);
  });

  it("invalidates the checksum when portable content changes", () => {
    const { document } = buildEmployeeTemplate(createProfile(), {
      generatedAt: timestamp,
      packageId,
    });
    document.payload.employee.role = "Changed after export";

    expect(verifyEmployeeTemplateChecksum(document)).toBe(false);
  });

  it("previews a compatible package in quarantine without activating it", () => {
    const { document } = buildEmployeeTemplate(createProfile(), {
      generatedAt: timestamp,
      packageId,
    });
    const preview = inspectEmployeeTemplate(document, [
      {
        id: "node-1",
        name: "Linux worker",
        platform: "linux",
        osVersion: "6.8",
        architecture: "x64",
        deviceClass: "server",
        isolation: "container",
        trustTier: "development",
        capabilities: ["browser", "screenshot"],
        capabilityManifest: [],
        activeRunIds: [],
        maxConcurrentRuns: 1,
        connectedAt: timestamp,
        lastSeenAt: timestamp,
      },
    ]);

    expect(preview.blocked).toBe(false);
    expect(preview.compatibility.compatibleHosts).toEqual([
      expect.objectContaining({ id: "node-1", platform: "linux" }),
    ]);
    expect(preview.integrity.valid).toBe(true);
    expect(preview.signature).toEqual({ status: "unsigned", trusted: false });
    expect(preview.quarantine).toEqual({
      active: true,
      createsNewIdentity: true,
      importedSkillState: "disabled-pending-review",
      hostAuthority: "none",
      memoryCount: 0,
      canActivate: false,
    });
  });

  it("blocks a tampered or incompatible package while still returning a review projection", () => {
    const { document } = buildEmployeeTemplate(createProfile(), {
      generatedAt: timestamp,
      packageId,
    });
    document.payload.employee.role = "Changed after checksum";
    const preview = inspectEmployeeTemplate(document, []);

    expect(preview.blocked).toBe(true);
    expect(preview.integrity.valid).toBe(false);
    expect(preview.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["checksum-mismatch", "missing-capability", "no-compatible-host"]),
    );
  });
});

function createProfile(): EmployeeProfile {
  return {
    employee: {
      id: "source-bot-id",
      name: "Ops",
      role: "Browser operations",
      status: "idle",
      computerProfile: "docker-linux",
      appearance: {
        head: "round",
        body: "classic",
        mobility: "feet",
        accessory: "none",
        accent: "green",
      },
      createdAt: timestamp,
    },
    evolution: [
      {
        id: "evolution-id",
        botId: "source-bot-id",
        type: "skill_verified",
        title: "Skill verified",
        summary: "Evidence stayed on the source Server.",
        source: "manual",
        evidence: [{ kind: "manual", id: "skill-evidence-id" }],
        createdAt: timestamp,
      },
    ],
    skills: [
      {
        id: "verified-skill-id",
        slug: "browse-web",
        name: "Browse web",
        description: "Navigate approved websites.",
        version: "1.0.0",
        source: "built-in",
        state: "verified",
        confidence: 1,
        requiredCapabilities: ["browser"],
        dependencyIds: [],
        evidence: [{ kind: "manual", id: "skill-evidence-id" }],
        acquiredAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "candidate-skill-id",
        slug: "unverified-action",
        name: "Unverified action",
        description: "Must not be exported by default.",
        version: "0.1.0",
        source: "learned",
        state: "candidate",
        confidence: 0.4,
        requiredCapabilities: ["host.gui"],
        dependencyIds: [],
        evidence: [],
        acquiredAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    memories: [
      {
        id: "private-memory",
        botId: "source-bot-id",
        kind: "secret-reference",
        title: "Never export",
        content: "password=private-memory-value",
        sensitivity: "restricted",
        portability: "never",
        provenance: { localPath: "/Users/owner/private.txt" },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    records: {
      runs: [],
      approvals: [
        {
          id: "approval-id",
          runId: "run-id",
          channelId: "channel-id",
          botId: "source-bot-id",
          nodeId: "node-id",
          action: "submit",
          target: "example.com",
          summary: "Submit form",
          risk: "write",
          targetFingerprint: "fingerprint",
          beforeState: {},
          status: "approved",
          expiresAt: timestamp,
          createdAt: timestamp,
        },
      ],
      artifacts: [],
      decisions: [],
    },
    statistics: {
      totalRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
      verifiedSkills: 1,
    },
    configuration: {
      executionProfile: "docker-linux",
      portabilityFormat: "openbot.employee/v1",
    },
  };
}
