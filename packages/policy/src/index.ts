export type PolicyEffect = "allow" | "require_approval" | "deny";

export interface PolicyRule {
  id: string;
  action: string;
  effect: PolicyEffect;
  targetPrefix?: string;
}

export interface PolicyRequest {
  action: string;
  target: string;
}

export interface PolicyDecision {
  effect: PolicyEffect;
  ruleId: string;
  reason: string;
}

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
  };
}
