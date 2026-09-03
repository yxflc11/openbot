import type { Bot, Channel, ExecutionNode, Run } from "@openbot/domain";
import { indexActiveRunsByBot, runStatusLabel } from "../run-state";
import { BotIcon, HashIcon, NodeIcon, OfficeIcon, PlusIcon } from "./Icons";
import { RobotAvatar } from "./RobotAvatar";

export type MobilePanel = "channels" | "bots" | "nodes" | undefined;

export function MobileNavigation({
  panel,
  bots,
  channels,
  nodes,
  runs,
  onPanel,
  onOffice,
  onCreateBot,
  onCreateChannel,
  onSelectChannel,
}: {
  panel: MobilePanel;
  bots: Bot[];
  channels: Channel[];
  nodes: ExecutionNode[];
  runs: Run[];
  onPanel(panel: MobilePanel): void;
  onOffice(): void;
  onCreateBot(): void;
  onCreateChannel(): void;
  onSelectChannel(channelId: string): void;
}) {
  const activeRunByBot = indexActiveRunsByBot(runs);
  return (
    <>
      {panel ? (
        <section className="mobile-sheet" aria-label={panelLabel(panel)}>
          <header className="mobile-sheet-header">
            <h2>{panelLabel(panel)}</h2>
            <button type="button" onClick={() => onPanel(undefined)}>
              完成
            </button>
          </header>
          {panel === "channels" ? (
            <>
              <button className="mobile-create" type="button" onClick={onCreateChannel}>
                <PlusIcon />
                创建频道
              </button>
              {channels.map((channel) => (
                <button
                  className="mobile-list-row"
                  type="button"
                  key={channel.id}
                  onClick={() => onSelectChannel(channel.id)}
                >
                  <HashIcon />
                  <span className="mobile-list-label">{channel.name}</span>
                  <small>{channel.botIds.length} Bots</small>
                </button>
              ))}
            </>
          ) : panel === "bots" ? (
            <>
              <button className="mobile-create" type="button" onClick={onCreateBot}>
                <PlusIcon />
                创建 Bot
              </button>
              {bots.map((bot) => {
                const run = activeRunByBot.get(bot.id);
                return (
                  <div className="mobile-list-row" key={bot.id}>
                    <RobotAvatar bot={bot} compact status={run?.status ?? bot.status} />
                    <span className="mobile-list-label">{bot.name}</span>
                    <small>{run ? runStatusLabel(run.status) : "待命"}</small>
                  </div>
                );
              })}
            </>
          ) : nodes.length === 0 ? (
            <p className="mobile-empty">没有在线节点</p>
          ) : (
            nodes.map((node) => (
              <div className="mobile-list-row" key={node.id}>
                <NodeIcon />
                <span className="mobile-list-label">{node.name}</span>
                <small>
                  {node.activeRunIds.length}/{node.maxConcurrentRuns} 任务
                </small>
              </div>
            ))
          )}
        </section>
      ) : null}
      <nav className="mobile-nav" aria-label="移动端导航">
        <button type="button" onClick={onOffice}>
          <OfficeIcon />
          <span>办公室</span>
        </button>
        <button type="button" onClick={() => onPanel("channels")}>
          <HashIcon />
          <span>频道</span>
        </button>
        <button type="button" onClick={() => onPanel("bots")}>
          <BotIcon />
          <span>Bots</span>
        </button>
        <button type="button" onClick={() => onPanel("nodes")}>
          <NodeIcon />
          <span>节点</span>
        </button>
      </nav>
    </>
  );
}

function panelLabel(panel: Exclude<MobilePanel, undefined>) {
  return panel === "channels" ? "频道" : panel === "bots" ? "Bots" : "节点";
}
