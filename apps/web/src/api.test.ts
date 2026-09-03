import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadEmployeeTemplate,
  isEmployeeProfileChangedEvent,
  updateEmployeeProfileDetails,
  updateEmployeeSkillState,
} from "./api";

afterEach(() => vi.restoreAllMocks());

describe("employee profile realtime invalidation", () => {
  it("accepts a content-free event with unique allowlisted sections", () => {
    expect(
      isEmployeeProfileChangedEvent({
        type: "employee.profile.changed",
        botId: "00000000-0000-4000-8000-000000000001",
        sections: ["skills", "evolution"],
        occurredAt: "2026-09-04T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it.each([
    { sections: [] },
    { sections: ["memory", "memory"] },
    { sections: ["authority"] },
    { sections: ["memory"], occurredAt: "not-a-timestamp" },
    { sections: ["memory"], content: "must not ride the event stream" },
  ])("rejects malformed or content-bearing events: %o", (override) => {
    expect(
      isEmployeeProfileChangedEvent({
        type: "employee.profile.changed",
        botId: "00000000-0000-4000-8000-000000000001",
        occurredAt: "2026-09-04T00:00:00.000Z",
        ...override,
      }),
    ).toBe(false);
  });
});

describe("employee skill review API", () => {
  it("sends the explicit Owner-reviewed transition without widening the request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ skill: { id: "skill-1" }, evolution: { id: "event-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await updateEmployeeSkillState("employee-1", "skill-1", {
      state: "verified",
      confidence: 87,
      reason: "The Owner reviewed the stored evidence.",
      evidence: [],
      ownerReviewed: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/bots/employee-1/skills/skill-1/state");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(JSON.parse(String(init?.body))).toEqual({
      state: "verified",
      confidence: 87,
      reason: "The Owner reviewed the stored evidence.",
      evidence: [],
      ownerReviewed: true,
    });
  });
});

describe("Employee profile details API", () => {
  it("sends only descriptive fields and the Server revision", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          employee: { id: "employee-1" },
          details: { revision: 4 },
          evolution: { id: "event-1" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await updateEmployeeProfileDetails("employee-1", {
      role: "Evidence reviewer",
      description: "Review evidence and document limitations.",
      expectedRevision: 3,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/v1/bots/employee-1/profile");
    expect(init).toMatchObject({ method: "PATCH", credentials: "include" });
    expect(JSON.parse(String(init?.body))).toEqual({
      role: "Evidence reviewer",
      description: "Review evidence and document limitations.",
      expectedRevision: 3,
    });
  });
});

describe("Employee export review binding", () => {
  it("returns the reviewed package identity and strong tag on download", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "The export changed." }), {
        status: 412,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      downloadEmployeeTemplate("employee/1", {
        format: "openbot.employee/v1",
        kind: "template",
        packageId: "00000000-0000-4000-8000-000000000099",
        fileName: "employee.openbot-employee.json",
        generatedAt: "2026-09-04T00:00:00.000Z",
        employee: { name: "Employee", role: "Research" },
        skills: [],
        employeeName: "Employee",
        verifiedSkillCount: 0,
        requestedCapabilities: [],
        includedMemoryCount: 0,
        exclusions: [],
        findings: [],
        blocked: false,
        checksum: "a".repeat(64),
        downloadReviewToken: "b".repeat(64),
        signatureStatus: "unsigned",
        identityOnImport: "new",
        hostAuthority: "none",
      }),
    ).rejects.toMatchObject({ status: 412 });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "/api/v1/bots/employee%2F1/export?packageId=00000000-0000-4000-8000-000000000099&generatedAt=2026-09-04T00%3A00%3A00.000Z",
    );
    expect(init).toMatchObject({
      credentials: "include",
      headers: { "If-Match": `"${"b".repeat(64)}"` },
    });
  });
});
