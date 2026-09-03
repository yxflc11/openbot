import type { ExecutionNode, WorkspaceSnapshot } from "@openbot/domain";
import { NodeIcon } from "./Icons";

export function ContextRail({ workspace }: { workspace: WorkspaceSnapshot }) {
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
          {node.platform} · {node.capabilities.length} 项能力
        </small>
      </div>
      <em>在线</em>
    </div>
  );
}
