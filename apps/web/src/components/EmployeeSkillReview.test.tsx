import type { EmployeeProfile } from "@openbot/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { allowedSkillReviewStates, EmployeeSkillReview } from "./EmployeeSkillReview";

const profile: EmployeeProfile = {
  employee: {
    id: "employee-1",
    name: "Researcher",
    role: "Evidence-backed research",
    status: "idle",
    computerProfile: "docker-linux",
    createdAt: "2026-09-03T00:00:00.000Z",
  },
  details: { description: "", revision: 1, updatedAt: "2026-09-03T00:00:00.000Z" },
  evolution: [],
  skills: [
    {
      id: "skill-1",
      slug: "source-triangulation",
      name: "Source triangulation",
      description: "Compare independent primary sources before reporting a conclusion.",
      version: "1.0.0",
      source: "learned",
      state: "candidate",
      confidence: 0,
      requiredCapabilities: ["browser.observe"],
      dependencyIds: [],
      evidence: [{ kind: "run", id: "run-42", label: "Evaluation fixture" }],
      acquiredAt: "2026-09-03T00:00:00.000Z",
      updatedAt: "2026-09-03T00:00:00.000Z",
    },
  ],
  memories: [],
  memoryEvents: [],
  records: { runs: [], approvals: [], artifacts: [], decisions: [] },
  statistics: { totalRuns: 0, completedRuns: 0, failedRuns: 0, verifiedSkills: 0 },
  configuration: { executionProfile: "docker-linux", portabilityFormat: "openbot.employee/v1" },
};

describe("EmployeeSkillReview", () => {
  it("keeps lifecycle actions inside the Server-supported transition graph", () => {
    expect(allowedSkillReviewStates("candidate")).toEqual(["verified", "suspended", "revoked"]);
    expect(allowedSkillReviewStates("verified")).toEqual(["suspended", "revoked"]);
    expect(allowedSkillReviewStates("suspended")).toEqual(["verified", "revoked"]);
    expect(allowedSkillReviewStates("revoked")).toEqual([]);
  });

  it("renders inspectable metadata, evidence, and the no-authority review boundary", () => {
    const html = renderToStaticMarkup(
      <EmployeeSkillReview profile={profile} onProfileChanged={async () => undefined} />,
    );

    expect(html).toContain("Source triangulation");
    expect(html).toContain("browser.observe");
    expect(html).toContain("Evaluation fixture");
    expect(html).toContain("验证技能");
    expect(html).toContain("永久撤销");
    expect(html).toContain("不会授予电脑权限");
  });
});
