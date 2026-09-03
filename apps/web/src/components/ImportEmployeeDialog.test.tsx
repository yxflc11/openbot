import type { EmployeeImportPreview } from "@openbot/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImportPreviewDetails } from "./ImportEmployeeDialog";

const preview: EmployeeImportPreview = {
  format: "openbot.employee/v1",
  packageId: "00000000-0000-4000-8000-000000000099",
  generatedAt: "2026-09-04T00:00:00.000Z",
  employee: {
    name: "Researcher",
    role: "研究与事实核查",
    description: "比较多个独立来源，并明确记录证据与限制。",
  },
  recommendedExecutionProfile: "docker-linux",
  skills: [
    {
      slug: "source-review",
      name: "来源审核",
      version: "1.0.0",
      requiredCapabilities: ["browser"],
      dependencySlugs: [],
    },
  ],
  requestedCapabilities: ["browser"],
  integrity: {
    algorithm: "sha256",
    valid: true,
    digest: "4b6c55f00000000000000000000000000000000000000000000000000000000",
  },
  signature: { status: "unsigned", trusted: false },
  compatibility: {
    hostRequired: true,
    compatibleHosts: [
      {
        id: "node-1",
        name: "Linux worker",
        platform: "linux",
        architecture: "x64",
        deviceClass: "server",
      },
    ],
    missingCapabilities: [],
  },
  quarantine: {
    active: true,
    createsNewIdentity: true,
    importedSkillState: "disabled-pending-review",
    hostAuthority: "none",
    memoryCount: 0,
    canActivate: true,
  },
  issues: [],
  blocked: false,
};

describe("ImportPreviewDetails", () => {
  it("shows descriptive identity, requested capabilities, trust, and authority before activation", () => {
    const html = renderToStaticMarkup(
      <ImportPreviewDetails
        preview={preview}
        fileName="researcher.openbot.employee.json"
        employeeName="Researcher"
        ownerReviewed={false}
        allowUnsigned={false}
        onEmployeeNameChange={() => undefined}
        onOwnerReviewedChange={() => undefined}
        onAllowUnsignedChange={() => undefined}
      />,
    );

    expect(html).toContain("员工资料");
    expect(html).toContain("研究与事实核查");
    expect(html).toContain("比较多个独立来源，并明确记录证据与限制。");
    expect(html).toContain("browser");
    expect(html).toContain("未签名 / 不受信任");
    expect(html).toContain("不会授予技能、电脑或账号权限");
    expect(html).toContain("禁用，等待审核");
  });

  it("labels an older v1 package that has no biography", () => {
    const html = renderToStaticMarkup(
      <ImportPreviewDetails
        preview={{ ...preview, employee: { name: "Legacy", role: "旧模板" } }}
        fileName="legacy.json"
        employeeName="Legacy"
        ownerReviewed={false}
        allowUnsigned={false}
        onEmployeeNameChange={() => undefined}
        onOwnerReviewedChange={() => undefined}
        onAllowUnsignedChange={() => undefined}
      />,
    );

    expect(html).toContain("模板未提供简介。");
  });
});
