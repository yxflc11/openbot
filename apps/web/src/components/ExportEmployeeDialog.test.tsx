import type { EmployeeExportPreview } from "@openbot/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExportPreviewDetails } from "./ExportEmployeeDialog";

const preview: EmployeeExportPreview = {
  format: "openbot.employee/v1",
  kind: "template",
  fileName: "researcher.openbot-employee.json",
  generatedAt: "2026-09-04T00:00:00.000Z",
  employee: {
    name: "Researcher",
    role: "研究与事实核查",
    description: "比较多个独立来源，并明确记录证据与限制。",
  },
  skills: [
    {
      slug: "source-review",
      name: "来源审核",
      description: "检查多个独立来源，并保留可以复核的引用。",
      version: "1.0.0",
      requiredCapabilities: ["browser"],
      dependencySlugs: ["evidence-core"],
    },
  ],
  employeeName: "Researcher",
  verifiedSkillCount: 1,
  requestedCapabilities: ["browser"],
  includedMemoryCount: 0,
  exclusions: [
    { category: "identity", count: 1, reason: "Source identity stays local." },
    { category: "authority", count: 1, reason: "Authority stays local." },
    { category: "memory", count: 2, reason: "Memory stays local." },
    { category: "work-history", count: 3, reason: "History stays local." },
  ],
  findings: [],
  blocked: false,
  checksum: "4db13fa00000000000000000000000000000000000000000000000000000000",
  signatureStatus: "unsigned",
  identityOnImport: "new",
  hostAuthority: "none",
};

describe("ExportPreviewDetails", () => {
  it("shows the exact descriptive profile and selected skill metadata before download", () => {
    const html = renderToStaticMarkup(<ExportPreviewDetails preview={preview} />);

    expect(html).toContain("研究与事实核查");
    expect(html).toContain("比较多个独立来源，并明确记录证据与限制。");
    expect(html).toContain("检查多个独立来源，并保留可以复核的引用。");
    expect(html).toContain("evidence-core");
    expect(html).toContain("已验证，将包含");
    expect(html).toContain("明确排除");
    expect(html).toContain("不会携带来源身份或电脑权限");
    expect(html).toContain("当前 Server 未配置发布密钥");
  });

  it("renders truthful empty states for an older profile with no biography or verified skills", () => {
    const html = renderToStaticMarkup(
      <ExportPreviewDetails
        preview={{
          ...preview,
          employee: { name: "Legacy", role: "旧模板" },
          skills: [],
          verifiedSkillCount: 0,
          requestedCapabilities: [],
        }}
      />,
    );

    expect(html).toContain("模板未提供简介。");
    expect(html).toContain("没有已验证技能会进入模板。");
  });
});
