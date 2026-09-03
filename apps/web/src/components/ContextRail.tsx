import type { ExecutionNode, WorkspaceSnapshot } from "@openbot/domain";
import { isActiveRun, runStatusLabel } from "../run-state";
import { NodeIcon } from "./Icons";

export function ContextRail({ workspace }: { workspace: WorkspaceSnapshot }) {
  const activeRuns = workspace.runs.filter(isActiveRun);
  const recentResults = workspace.runs
    .filter((run) => run.status === "completed" || run.status === "failed")
    .slice(0, 2);
  const botById = new Map(workspace.bots.map((bot) => [bot.id, bot]));
  const nodeById = new Map(workspace.nodes.map((node) => [node.id, node]));
  return (
    <aside className="context-rail" aria-label="运行状态">
      <h2>运行状态</h2>
      <dl className="stat-grid">
        <Metric label="频道" value={workspace.counts.channels} />
        <Metric label="Bots" value={workspace.counts.bots} />
        <Metric label="在线节点" value={workspace.counts.connectedNodes} />
      </dl>

      <section className="rail-section attention">
        <h3>需要处理</h3>
        <div className="attention-empty">
          <span className="attention-symbol" aria-hidden="true">
            ⌑
          </span>
          <p>暂无待处理事项</p>
        </div>
      </section>

      <section className="rail-section runs-section">
        <h3>当前任务</h3>
        {activeRuns.length === 0 ? (
          <p className="rail-empty">暂无执行中的任务</p>
        ) : (
          activeRuns.slice(0, 4).map((run) => {
            const bot = botById.get(run.botId);
            const node = run.nodeId === undefined ? undefined : nodeById.get(run.nodeId);
            return (
              <article className="rail-run" key={run.id}>
                <span className={`run-status ${run.status}`}>{runStatusLabel(run.status)}</span>
                <strong>{run.title}</strong>
                <small>
                  {bot?.name ?? "未知 Bot"} · {node?.name ?? "等待节点"}
                </small>
              </article>
            );
          })
        )}
      </section>

      {recentResults.length > 0 ? (
        <section className="rail-section result-section">
          <h3>最近结果</h3>
          {recentResults.map((run) => {
            const artifact = workspace.artifacts.find((item) => item.runId === run.id);
            return (
              <article className="rail-result" key={run.id}>
                <span className={`run-status ${run.status}`}>{runStatusLabel(run.status)}</span>
                <strong>{run.title}</strong>
                <p>{run.errorMessage ?? run.resultSummary ?? "任务已结束。"}</p>
                {artifact ? (
                  <a
                    href={`/api/v1/artifacts/${artifact.id}/content`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看截图
                  </a>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      <section className="rail-section nodes-section">
        <h3>电脑</h3>
        {workspace.nodes.length === 0 ? (
          <div className="node-row offline">
            <span className="status-dot" />
            <NodeIcon />
            <div>
              <strong>没有在线节点</strong>
              <small>启动 OpenBot Node 后会显示在这里</small>
            </div>
          </div>
        ) : (
          workspace.nodes.map((node) => <NodeRow node={node} key={node.id} />)
        )}
      </section>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function NodeRow({ node }: { node: ExecutionNode }) {
  return (
    <div className="node-row">
      <span className="status-dot online" />
      <NodeIcon />
      <div>
        <strong>{node.name}</strong>
        <small>
          {node.platform} · {node.activeRunIds.length}/{node.maxConcurrentRuns} 任务 ·{" "}
          {node.capabilities.length} 项能力
        </small>
      </div>
      <em>在线</em>
    </div>
  );
}
