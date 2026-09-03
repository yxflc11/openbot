import type { Bot, BotStatus, Channel, ExecutionNode, Run, RunStatus } from "@openbot/domain";
import type { ComponentType } from "react";

export const officePluginManifest = {
  id: "office",
  name: "办公室",
  apiVersion: 1,
  status: "deferred",
  description: "Optional spatial overview for Bots and replaceable execution nodes.",
} as const;

export interface OfficePluginProps {
  bots: Bot[];
  channels: Channel[];
  nodes: ExecutionNode[];
  runs: Run[];
  Avatar: ComponentType<{ bot: Bot; status?: BotStatus | RunStatus }>;
  onCreateBot(): void;
  onOpenChannel(channelId: string): void;
  onInspectRun(runId: string): void;
}

export function OfficePluginView({
  bots,
  channels,
  nodes,
  runs,
  Avatar,
  onCreateBot,
  onOpenChannel,
  onInspectRun,
}: OfficePluginProps) {
  const activeRuns = new Map(
    runs
      .filter((run) => ["assigned", "running", "waiting_approval", "blocked"].includes(run.status))
      .map((run) => [run.botId, run]),
  );
  const channelById = new Map(channels.map((channel) => [channel.id, channel]));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <section className="openbot-office-plugin" aria-label="OpenBot 办公室">
      <header>
        <div>
          <span>OPTIONAL PLUGIN</span>
          <h1>办公室</h1>
        </div>
        <button type="button" onClick={onCreateBot}>
          添加 Bot
        </button>
      </header>
      <div className="openbot-office-grid">
        {bots.map((bot) => {
          const run = activeRuns.get(bot.id);
          const channel = run === undefined ? undefined : channelById.get(run.channelId);
          const node = run?.nodeId === undefined ? undefined : nodeById.get(run.nodeId);
          return (
            <article className={run ? "is-active" : ""} key={bot.id}>
              <div className="openbot-office-avatar">
                <Avatar bot={bot} status={run?.status ?? bot.status} />
              </div>
              <h2>{bot.name}</h2>
              <p>{run?.title ?? bot.role}</p>
              <small>{node?.name ?? "未绑定执行节点"}</small>
              {run && channel ? (
                <div>
                  <button type="button" onClick={() => onOpenChannel(channel.id)}>
                    #{channel.name}
                  </button>
                  <button type="button" onClick={() => onInspectRun(run.id)}>
                    任务详情
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
