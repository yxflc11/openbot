import { createHash, webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createModelConnection,
  discoverConnectionModels,
  downloadEmployeeTemplate,
  getModelServices,
  isEmployeeProfileChangedEvent,
  updateEmployeeProfileDetails,
  updateEmployeeModel,
  updateModelConnection,
  testModelConnection,
  updateEmployeeSkillState,
} from "./api";

describe("model services API", () => {
  it("keeps model discovery separate from a paid inference test", async () => {
    const controller = new AbortController();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ models: ["vendor/model:version"] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(discoverConnectionModels("account/1", controller.signal)).resolves.toEqual(["vendor/model:version"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/model-connections/account%2F1/models");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST", credentials: "include" });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    await testModelConnection("account/1", "vendor/model:version");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/model-connections/account%2F1/test");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ modelId: "vendor/model:version" });
  });

  it("uses the public snapshot and revision-bound key rotation endpoints", async () => {
    const snapshot = { presets: [], connections: [], customBaseUrls: [] };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(snapshot), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ connection: { id: "account-1" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ connection: { id: "account-1" } }), { status: 200 }));
    await expect(getModelServices()).resolves.toEqual(snapshot);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/model-services");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined();
    await createModelConnection({ name: "DeepSeek", presetId: "deepseek", baseUrl: "https://api.deepseek.com", apiKey: "test-only-key" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/model-connections");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ name: "DeepSeek", presetId: "deepseek", baseUrl: "https://api.deepseek.com", apiKey: "test-only-key" });
    await updateModelConnection("account-1", { expectedRevision: 4, enabled: false });
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({ expectedRevision: 4, enabled: false });
  });

  it.each([{ connectionId: "account-1", modelId: "vendor/model" }, null])("sends an explicit employee binding with its revision: %o", async (model) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ employee: {}, details: { revision: 3 } }), { status: 200 }));
    await updateEmployeeModel("employee/1", { expectedRevision: 2, model });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/bots/employee%2F1/model");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PATCH", credentials: "include" });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ expectedRevision: 2, model });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

    await expect(downloadEmployeeTemplate("employee/1", exportPreview())).rejects.toMatchObject({
      status: 412,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "/api/v1/bots/employee%2F1/export?packageId=00000000-0000-4000-8000-000000000099&generatedAt=2026-09-04T00%3A00%3A00.000Z",
    );
    expect(init).toMatchObject({
      credentials: "include",
      headers: { "If-Match": `"${"b".repeat(64)}"` },
    });
  });

  it("rejects response bytes that do not match the reviewed digest before download", async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("changed bytes", {
        status: 200,
        headers: { ETag: `"${"b".repeat(64)}"` },
      }),
    );

    await expect(downloadEmployeeTemplate("employee-1", exportPreview())).rejects.toThrow(
      "未通过完整性检查",
    );
  });

  it.each([
    ["missing", undefined],
    ["changed", `"${"c".repeat(64)}"`],
  ])("rejects a %s response tag before creating a download", async (_label, responseTag) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("changed bytes", {
        status: 200,
        headers: responseTag === undefined ? undefined : { ETag: responseTag },
      }),
    );

    await expect(downloadEmployeeTemplate("employee-1", exportPreview())).rejects.toThrow(
      "未匹配已审核的员工模板",
    );
  });

  it("fails closed when the browser cannot hash the received bytes", async () => {
    const body = '{"portable":true}\n';
    const reviewToken = createHash("sha256").update(body).digest("hex");
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { ETag: `"${reviewToken}"` },
      }),
    );

    await expect(
      downloadEmployeeTemplate("employee-1", {
        ...exportPreview(),
        downloadReviewToken: reviewToken,
      }),
    ).rejects.toThrow("无法安全校验员工模板");
  });

  it("creates a browser download only after the response tag and received bytes match", async () => {
    const body = '{"portable":true}\n';
    const reviewToken = createHash("sha256").update(body).digest("hex");
    const click = vi.fn();
    const remove = vi.fn();
    const append = vi.fn();
    vi.stubGlobal("crypto", webcrypto);
    vi.stubGlobal("document", {
      body: { append },
      createElement: vi.fn(() => ({ click, remove })),
    });
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:reviewed");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { ETag: `"${reviewToken}"` },
      }),
    );

    await downloadEmployeeTemplate("employee-1", {
      ...exportPreview(),
      downloadReviewToken: reviewToken,
    });

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:reviewed");
  });
});

function exportPreview() {
  return {
    format: "openbot.employee/v1" as const,
    kind: "template" as const,
    packageId: "00000000-0000-4000-8000-000000000099",
    fileName: "employee.openbot-employee.json",
    generatedAt: "2026-09-04T00:00:00.000Z",
    employee: { name: "Employee", role: "Research" },
    skills: [],
    employeeName: "Employee",
    verifiedSkillCount: 0,
    requestedCapabilities: [],
    includedMemoryCount: 0 as const,
    exclusions: [],
    findings: [],
    blocked: false,
    checksum: "a".repeat(64),
    downloadReviewToken: "b".repeat(64),
    signatureStatus: "unsigned" as const,
    identityOnImport: "new" as const,
    hostAuthority: "none" as const,
  };
}
