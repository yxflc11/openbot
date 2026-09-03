import type { EmployeeProfile } from "@openbot/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmployeeProfileView, profileTabForNavigationKey } from "./EmployeeProfileView";

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
});
