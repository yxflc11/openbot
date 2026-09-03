import type { ExecutionNode, Run } from "@openbot/domain";
import type { NodeCapability } from "@openbot/protocol";

export interface ExecutionRequirements {
  capabilities: NodeCapability[];
  executionProfile: Exclude<Run["executionProfile"], "none">;
  platform?: ExecutionNode["platform"];
}

export function requirementsForRun(run: Run): ExecutionRequirements | undefined {
  switch (run.executionProfile) {
    case "docker-linux":
      return { capabilities: ["browser", "screenshot"], executionProfile: "docker-linux" };
    case "macos-cua":
      return {
        capabilities: ["cua", "screenshot"],
        executionProfile: "macos-cua",
        platform: "macos",
      };
    case "lume-vm":
      return {
        capabilities: ["lume", "screenshot"],
        executionProfile: "lume-vm",
        platform: "macos",
      };
    case "coder":
      return { capabilities: ["coder"], executionProfile: "coder" };
    case "none":
      return undefined;
  }
}

export function selectExecutionNode(
  run: Run,
  nodes: ExecutionNode[],
): { node: ExecutionNode; requirements: ExecutionRequirements } | undefined {
  const requirements = requirementsForRun(run);
  if (requirements === undefined) return undefined;

  const candidates = nodes.filter((node) => {
    if (node.activeRunIds.length >= node.maxConcurrentRuns) return false;
    if (requirements.platform !== undefined && node.platform !== requirements.platform)
      return false;
    const capabilities = new Set(node.capabilities);
    return requirements.capabilities.every((capability) => capabilities.has(capability));
  });
  candidates.sort(
    (left, right) =>
      left.activeRunIds.length - right.activeRunIds.length || left.id.localeCompare(right.id),
  );
  const node = candidates[0];
  return node === undefined ? undefined : { node, requirements };
}
