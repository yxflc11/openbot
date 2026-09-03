import { afterEach, describe, expect, it, vi } from "vitest";
import {
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
