import type { Run } from "@openbot/domain";

const activeStatuses = new Set<Run["status"]>(["queued", "running", "waiting_approval", "blocked"]);

export function isActiveRun(run: Run): boolean {
  return activeStatuses.has(run.status);
}

export function mergeRuns(primary: Run[], secondary: Run[]): Run[] {
  const byId = new Map<string, Run>();
  for (const run of [...primary, ...secondary]) byId.set(run.id, run);
  return Array.from(byId.values())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 50);
}

export function indexActiveRunsByBot(runs: Run[]): Map<string, Run> {
  const result = new Map<string, Run>();
  for (const run of runs) {
    if (isActiveRun(run) && !result.has(run.botId)) result.set(run.botId, run);
  }
  return result;
}

export function runStatusLabel(status: Run["status"]): string {
  const labels: Record<Run["status"], string> = {
    queued: "已接单",
    running: "执行中",
    waiting_approval: "待批准",
    blocked: "已阻塞",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[status];
}
