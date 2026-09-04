import type { PolicyRisk, PolicyRule } from "@openbot/policy";

/**
 * Side-effecting actions supported by the current pre-alpha control plane.
 * Adding an action requires a Server review; Node messages cannot extend this catalog.
 */
export const approvalPolicyRules = [
  {
    id: "browser-form-submit-v1",
    action: "form.submit",
    targetPrefix: "https://",
    effect: "require_approval",
    minimumRisk: "write",
  },
] as const satisfies readonly PolicyRule[];

const riskRank: Record<PolicyRisk, number> = {
  write: 1,
  destructive: 2,
  privileged: 3,
};

export function isRiskDowngrade(reported: PolicyRisk, minimum: PolicyRisk): boolean {
  return riskRank[reported] < riskRank[minimum];
}
