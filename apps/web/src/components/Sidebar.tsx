import type { Bot, Channel, Run } from "@openbot/domain";
import { useState } from "react";
import { indexActiveRunsByBot, runStatusLabel } from "../run-state";
import {
  AutomationIcon,
  BotIcon,
  ComposeIcon,
  HashIcon,
  NodeIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SkillIcon,
} from "./Icons";
import { OpenBotMark } from "./OpenBotMark";
import { RobotAvatar } from "./RobotAvatar";

interface SidebarProps {
  destination?: "chat" | "automations" | "skills";
  onAutomations?: (() => void) | undefined;
  onSkills?: (() => void) | undefined;
  bots: Bot[];
  channels: Channel[];
  runs: Run[];
  ownerName: string;
  onSettings?: (() => void) | undefined;
  selectedChannelId?: string | undefined;
  selectedBotId?: string | undefined;
  onSelectChannel(channelId: string): void;
  onSelectBot(botId: string): void;
  onCreateBot(): void;
  onCreateChannel(): void;
  onManageNodes(): void;
  onLogout(): Promise<void>;
}

export function Sidebar({
  destination,
  onAutomations,
  onSkills,
  bots,
  channels,
  runs,
  ownerName,
  onSettings,
  selectedChannelId,
  selectedBotId,
  onSelectChannel,
  onSelectBot,
  onCreateBot,
  onCreateChannel,
  onManageNodes,
  onLogout,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLocaleLowerCase();
  const filteredChannels = channels.filter((channel) =>
    `${channel.name} ${channel.description}`.toLocaleLowerCase().includes(term),
  );
  const filteredBots = bots.filter((bot) => bot.name.toLocaleLowerCase().includes(term));
  const activeRunByBot = indexActiveRunsByBot(runs);
  const [logoutError, setLogoutError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(false);
    try {
      await onLogout();
    } catch {
      setLogoutError(true);
      setLoggingOut(false);
    }
  }

  return (
    <aside className="sidebar" aria-label="主导航">
      <a className="brand" href="/" aria-label="OpenBot 首页">
        <OpenBotMark />
        OpenBot
      </a>

      <search className="sidebar-search" aria-label="搜索工作空间">
        <SearchIcon />
        <input
          aria-label="搜索频道或 Bot"
          type="search"
          placeholder="搜索频道或 Bot"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </search>
      <nav className="workspace-actions" aria-label="工作空间操作">
        <button type="button" onClick={onCreateChannel}>
          <ComposeIcon />
          <span>新建对话</span>
          <PlusIcon />
        </button>
        {onAutomations && (
          <button
            type="button"
            onClick={onAutomations}
            aria-current={destination === "automations" ? "page" : undefined}
          >
            <AutomationIcon />
            <span>自动任务</span>
          </button>
        )}
        {onSkills && (
          <button
            type="button"
            onClick={onSkills}
            aria-current={destination === "skills" ? "page" : undefined}
          >
            <SkillIcon />
            <span>技能广场</span>
          </button>
        )}
        <button type="button" onClick={onManageNodes}>
          <NodeIcon />
          <span>工作电脑</span>
        </button>
      </nav>
      <div className="sidebar-body">
        <SidebarSection title="频道" onAdd={onCreateChannel} addLabel="创建频道">
          {filteredChannels.length === 0 ? (
            <SidebarEmpty>{term ? "没有匹配的频道" : "还没有频道"}</SidebarEmpty>
          ) : (
            filteredChannels.map((channel) => (
              <button
                aria-current={selectedChannelId === channel.id ? "page" : undefined}
                className={`sidebar-row channel-list-row ${selectedChannelId === channel.id ? "selected" : ""}`}
                key={channel.id}
                onClick={() => onSelectChannel(channel.id)}
                type="button"
              >
                <span className="channel-list-avatar">
                  <HashIcon />
                </span>
                <span className="channel-list-copy">
                  <strong>{channel.name}</strong>
                  <small>
                    {channel.description || `${channel.botIds.length} 名 Bot · 开始对话`}
                  </small>
                </span>
              </button>
            ))
          )}
        </SidebarSection>

        <SidebarSection title="Bots" onAdd={onCreateBot} addLabel="创建 Bot">
          {filteredBots.length === 0 ? (
            <SidebarEmpty>{term ? "没有匹配的 Bot" : "还没有 Bot"}</SidebarEmpty>
          ) : (
            filteredBots.map((bot) => {
              const run = activeRunByBot.get(bot.id);
              return (
                <button
                  className={`sidebar-row bot-row ${selectedBotId === bot.id ? "selected" : ""}`}
                  type="button"
                  onClick={() => onSelectBot(bot.id)}
                  key={bot.id}
                >
                  <RobotAvatar bot={bot} compact status={run?.status ?? bot.status} />
                  <span>{bot.name}</span>
                  <small className="bot-state">
                    <span
                      className={`status-dot ${run ? "active" : "online"}`}
                      aria-hidden="true"
                    />
                    {run ? runStatusLabel(run.status) : "待命"}
                  </small>
                </button>
              );
            })
          )}
        </SidebarSection>
      </div>

      {onSettings ? (
        <button className="sidebar-settings" type="button" onClick={onSettings}>
          <SettingsIcon />
          <span>账号与设置</span>
        </button>
      ) : null}
      <footer className="sidebar-owner">
        <span>
          <strong>{ownerName}</strong>
          <small className={logoutError ? "warning" : ""} role={logoutError ? "alert" : undefined}>
            {logoutError ? "退出失败，请重试" : "工作空间所有者"}
          </small>
        </span>
        <button type="button" disabled={loggingOut} onClick={() => void handleLogout()}>
          {loggingOut ? "退出中" : "退出"}
        </button>
      </footer>
    </aside>
  );
}

function SidebarSection({
  title,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  onAdd(): void;
  addLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sidebar-section">
      <div className="sidebar-heading">
        <h2>{title}</h2>
        <button className="icon-button" type="button" aria-label={addLabel} onClick={onAdd}>
          <PlusIcon />
        </button>
      </div>
      <div className="sidebar-list">{children}</div>
    </section>
  );
}

function SidebarEmpty({ children }: { children: React.ReactNode }) {
  return (
    <button className="sidebar-empty" type="button" disabled>
      <BotIcon />
      {children}
    </button>
  );
}
