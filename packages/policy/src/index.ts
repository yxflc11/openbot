export type PolicyEffect = "allow" | "require_approval" | "deny";
export type PolicyRisk = "write" | "destructive" | "privileged";

export interface PolicyRule {
  id: string;
  action: string;
  effect: PolicyEffect;
  targetPrefix?: string;
  minimumRisk?: PolicyRisk;
}

export interface PolicyRequest {
  action: string;
  target: string;
}

export interface PolicyDecision {
  effect: PolicyEffect;
  ruleId: string;
  reason: string;
  minimumRisk?: PolicyRisk;
}

/**
 * Returns the first deterministic rule match and denies requests that have no explicit grant.
 * Model output must not alter this decision after evaluation.
 */
export function evaluatePolicy(
  request: PolicyRequest,
  rules: readonly PolicyRule[],
): PolicyDecision {
  const match = rules.find(
    (rule) =>
      rule.action === request.action &&
      (rule.targetPrefix === undefined || request.target.startsWith(rule.targetPrefix)),
  );

  if (match === undefined) {
    return {
      effect: "deny",
      ruleId: "default-deny",
      reason: "No policy rule granted this action.",
    };
  }

  return {
    effect: match.effect,
    ruleId: match.id,
    reason: `Matched policy rule ${match.id}.`,
    ...(match.minimumRisk === undefined ? {} : { minimumRisk: match.minimumRisk }),
  };
}
