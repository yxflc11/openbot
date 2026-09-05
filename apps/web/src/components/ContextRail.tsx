import type { ApprovalDecision, ExecutionNode, Run, WorkspaceSnapshot } from "@openbot/domain";
import type { RealtimeConnectionState } from "../api";
import "../context-rail.css";
import { isActiveRun, runStatusLabel } from "../run-state";
import { ApprovalCard } from "./ApprovalCard";
import { CheckIcon, NodeIcon } from "./Icons";

export function ContextRail({
  realtimeState,
  workspace,
  onDecideApproval,
  onInspectRun,
}: {
  realtimeState: RealtimeConnectionState;
  workspace: WorkspaceSnapshot;
  onDecideApproval(approvalId: string, decision: ApprovalDecision): Promise<void>;
  onInspectRun(runId: string): void;
}) {
  const activeRuns = workspace.runs.filter(isActiveRun);
  const completedCount = workspace.runs.filter((run) => run.status === "completed").length;
  const pendingApprovals = workspace.approvals.filter((approval) => approval.status === "pending");
  const recentResults = workspace.runs
    .filter((run) => !isActiveRun(run))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 3);
  const botById = new Map(workspace.bots.map((bot) => [bot.id, bot]));
  const channelById = new Map(workspace.channels.map((channel) => [channel.id, channel]));
  const nodeById = new Map(workspace.nodes.map((node) => [node.id, node]));

  return (
    <aside className="context-rail usage-rail" aria-label="用量与任务概览">
      <header className="usage-rail-header">
        <h2>工作区概览</h2>
        <span className={`usage-rail-connection ${realtimeState}`}>
          <i aria-hidden="true" />
          {realtimeState === "live"
            ? "已同步"
            : realtimeState === "retrying"
              ? "重新连接中"
              : "连接中"}
        </span>
      </header>

      <section className="usage-rail-tokens" aria-label="Token 用量">
        <h3>Token 用量</h3>
        <dl className="usage-rail-token-metrics">
          <Metric label="输入 Token" />
          <Metric label="输出 Token" />
        </dl>
        <p className="usage-rail-unavailable">暂无用量记录</p>
        <p className="usage-rail-caption">当前服务尚未提供模型用量数据</p>
      </section>

      <section className="usage-rail-section" aria-label="最近任务统计">
        <div className="usage-rail-section-heading">
          <h3>最近任务</h3>
          <span>{workspace.runs.length} 条记录</span>
        </div>
        <dl className="usage-rail-task-metrics">
          <Metric label="进行中" value={activeRuns.length} />
          <Metric label="已完成" value={completedCount} />
          <Metric label="记录数" value={workspace.runs.length} />
        </dl>
      </section>

      <section className="usage-rail-section" aria-label="需要确认的操作">
        <div className="usage-rail-section-heading">
          <h3>需要确认</h3>
          {pendingApprovals.length > 0 ? (
            <span className="usage-rail-attention-count">{pendingApprovals.length}</span>
          ) : null}
        </div>
        {pendingApprovals.length === 0 ? (
          <p className="usage-rail-clear">
            <CheckIcon />
            暂无待确认的操作
          </p>
        ) : (
          <div className="approval-list">
            {pendingApprovals.map((approval) => (
              <ApprovalCard
                approval={approval}
                bot={botById.get(approval.botId)}
                channel={channelById.get(approval.channelId)}
                onDecide={onDecideApproval}
                key={approval.id}
              />
            ))}
          </div>
        )}
      </section>

      <section className="usage-rail-section" aria-label="当前任务">
        <div className="usage-rail-section-heading">
          <h3>进行中</h3>
          {activeRuns.length > 4 ? <span>显示最近 4 条</span> : null}
        </div>
        {activeRuns.length === 0 ? (
          <p className="usage-rail-empty">任务开始后，进度会显示在这里</p>
        ) : (
          <div className="usage-rail-run-list">
            {activeRuns.slice(0, 4).map((run) => {
              const bot = botById.get(run.botId);
              const node = run.nodeId === undefined ? undefined : nodeById.get(run.nodeId);
              return (
                <RunRow
                  run={run}
                  detail={`${bot?.name ?? "未知 Bot"} · ${node?.name ?? "等待电脑"}`}
                  onInspect={onInspectRun}
                  key={run.id}
                />
              );
            })}
          </div>
        )}
      </section>

      {recentResults.length > 0 ? (
        <section className="usage-rail-section" aria-label="最近结果">
          <div className="usage-rail-section-heading">
            <h3>最近结果</h3>
          </div>
          <div className="usage-rail-run-list">
            {recentResults.map((run) => {
              const artifact = workspace.artifacts.find((item) => item.runId === run.id);
              return (
                <div className="usage-rail-result" key={run.id}>
                  <RunRow
                    run={run}
                    detail={run.errorMessage ?? run.resultSummary ?? botById.get(run.botId)?.name}
                    onInspect={onInspectRun}
                  />
                  {artifact ? (
                    <a
                      href={`/api/v1/artifacts/${encodeURIComponent(artifact.id)}/content`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      查看截图 <span aria-hidden="true">↗</span>
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="usage-rail-section usage-rail-computers" aria-label="工作电脑">
        <div className="usage-rail-section-heading">
          <h3>工作电脑</h3>
          <span>{workspace.nodes.length} 台在线</span>
        </div>
        {workspace.nodes.length === 0 ? (
          <div className="usage-rail-no-computer">
            <NodeIcon />
            <p>尚未连接工作电脑</p>
          </div>
        ) : (
          workspace.nodes.map((node) => <NodeRow node={node} key={node.id} />)
        )}
      </section>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value ?? (
          <span role="img" aria-label="暂无数据">
            —
          </span>
        )}
      </dd>
    </div>
  );
}

function RunRow({
  run,
  detail,
  onInspect,
}: {
  run: Run;
  detail: string | undefined;
  onInspect(runId: string): void;
}) {
  return (
    <button
      className="usage-rail-run"
      type="button"
      onClick={() => onInspect(run.id)}
      aria-label={`查看任务：${run.title}`}
    >
      <span className={`usage-rail-run-dot ${run.status}`} aria-hidden="true" />
      <span className="usage-rail-run-copy">
        <strong>{run.title}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
      <span className={`usage-rail-run-status ${run.status}`}>{runStatusLabel(run.status)}</span>
    </button>
  );
}

function NodeRow({ node }: { node: ExecutionNode }) {
  return (
    <div className="usage-rail-computer">
      <span className="usage-rail-computer-icon">
        <NodeIcon />
      </span>
      <div>
        <strong>{node.name}</strong>
        <small>
          {node.platform} · {node.activeRunIds.length}/{node.maxConcurrentRuns} 任务
        </small>
      </div>
      <span className="usage-rail-online" role="img" aria-label="在线" />
    </div>
  );
}
