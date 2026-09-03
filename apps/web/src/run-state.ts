import type { Artifact, ExecutionNode, Run, RunProgress } from "@openbot/domain";

const activeStatuses = new Set<Run["status"]>([
  "queued",
  "assigned",
  "running",
  "waiting_approval",
  "blocked",
]);

export function isActiveRun(run: Run): boolean {
  return activeStatuses.has(run.status);
}

export function mergeRuns(primary: Run[], secondary: Run[]): Run[] {
  const byId = new Map<string, Run>();
  for (const run of [...primary, ...secondary]) {
    const existing = byId.get(run.id);
    if (existing === undefined || isNewerProjection(run, existing)) byId.set(run.id, run);
  }
  return Array.from(byId.values())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 50);
}

export function mergeArtifacts(primary: Artifact[], secondary: Artifact[]): Artifact[] {
  const byId = new Map(primary.map((artifact) => [artifact.id, artifact]));
  for (const artifact of secondary) byId.set(artifact.id, artifact);
  return Array.from(byId.values()).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export function mergeProgress(primary: RunProgress[], secondary: RunProgress[]): RunProgress[] {
  const byId = new Map(primary.map((progress) => [progress.id, progress]));
  for (const progress of secondary) byId.set(progress.id, progress);
  return Array.from(byId.values())
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-200);
}

export function mergeNodes(primary: ExecutionNode[], secondary: ExecutionNode[]): ExecutionNode[] {
  const byId = new Map(primary.map((node) => [node.id, node]));
  for (const node of secondary) {
    const existing = byId.get(node.id);
    if (existing === undefined || node.lastSeenAt >= existing.lastSeenAt) byId.set(node.id, node);
  }
  return Array.from(byId.values()).sort((left, right) =>
    right.connectedAt.localeCompare(left.connectedAt),
  );
}

function isNewerProjection(candidate: Run, existing: Run): boolean {
  const timeComparison = candidate.updatedAt.localeCompare(existing.updatedAt);
  if (timeComparison !== 0) return timeComparison > 0;
  return statusRevision(candidate.status) > statusRevision(existing.status);
}

function statusRevision(status: Run["status"]): number {
  const revisions: Record<Run["status"], number> = {
    queued: 0,
    assigned: 1,
    running: 2,
    waiting_approval: 3,
    blocked: 3,
    completed: 4,
    failed: 4,
    cancelled: 4,
  };
  return revisions[status];
}

export function indexActiveRunsByBot(runs: Run[]): Map<string, Run> {
  const result = new Map<string, Run>();
  for (const run of runs) {
    if (isActiveRun(run) && !result.has(run.botId)) result.set(run.botId, run);
  }
  return result;
}

export function projectRunOnNodes(
  nodes: ExecutionNode[],
  previous: Run | undefined,
  current: Run,
): ExecutionNode[] {
  return nodes.map((node) => {
    const activeRunIds = new Set(node.activeRunIds);
    if (previous?.nodeId === node.id && occupiesNode(previous)) activeRunIds.delete(previous.id);
    if (current.nodeId === node.id && occupiesNode(current)) activeRunIds.add(current.id);
    return activeRunIds.size === node.activeRunIds.length &&
      node.activeRunIds.every((runId) => activeRunIds.has(runId))
      ? node
      : { ...node, activeRunIds: Array.from(activeRunIds) };
  });
}

export function runStatusLabel(status: Run["status"]): string {
  const labels: Record<Run["status"], string> = {
    queued: "已接单",
    assigned: "已分配",
    running: "执行中",
    waiting_approval: "待批准",
    blocked: "已阻塞",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[status];
}

function occupiesNode(run: Run): boolean {
  return (
    run.nodeId !== undefined &&
    (run.status === "assigned" ||
      run.status === "running" ||
      run.status === "waiting_approval" ||
      run.status === "blocked")
  );
}
