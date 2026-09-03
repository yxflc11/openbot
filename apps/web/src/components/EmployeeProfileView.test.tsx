import type { EmployeeProfile } from "@openbot/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  EmployeeMemoryPanel,
  EmployeeProfileView,
  profileTabForNavigationKey,
} from "./EmployeeProfileView";

const profile: EmployeeProfile = {
  employee: {
    id: "employee-1",
    name: "Coder",
    role: "代码开发与验证",
    status: "idle",
    computerProfile: "coder",
    createdAt: "2026-09-03T00:00:00.000Z",
  },
  evolution: [],
  skills: [],
  memories: [],
  memoryEvents: [],
  records: { runs: [], approvals: [], artifacts: [], decisions: [] },
  statistics: { totalRuns: 0, completedRuns: 0, failedRuns: 0, verifiedSkills: 0 },
  configuration: { executionProfile: "coder", portabilityFormat: "openbot.employee/v1" },
};

describe("EmployeeProfileView", () => {
  it("connects the active tab to a single labelled tab panel", () => {
    const html = renderToStaticMarkup(
      <EmployeeProfileView
        profile={profile}
        loading={false}
        error={undefined}
        onRetry={() => undefined}
        onAssign={() => undefined}
        onExport={() => undefined}
        onProfileChanged={async () => undefined}
      />,
    );

    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(7);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toMatch(/aria-controls="[^"]+-overview-panel"/);
    expect(html).toMatch(/aria-labelledby="[^"]+-overview-tab"/);
  });

  it("implements the standard horizontal tab navigation keys with wrapping", () => {
    expect(profileTabForNavigationKey("overview", "ArrowLeft")).toBe("configuration");
    expect(profileTabForNavigationKey("configuration", "ArrowRight")).toBe("overview");
    expect(profileTabForNavigationKey("memory", "Home")).toBe("overview");
    expect(profileTabForNavigationKey("memory", "End")).toBe("configuration");
    expect(profileTabForNavigationKey("memory", "ArrowDown")).toBeUndefined();
  });

  it("makes Owner memory controls and the no-transfer boundary explicit", () => {
    const html = renderToStaticMarkup(
      <EmployeeMemoryPanel profile={profile} onProfileChanged={async () => undefined} />,
    );

    expect(html).toContain("添加记忆");
    expect(html).toContain("模型不能直接写入");
    expect(html).toContain("不会进入当前员工模板");
  });
});
