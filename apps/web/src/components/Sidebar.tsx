import type { Bot, Channel, Run } from "@openbot/domain";
import { useState } from "react";
import { indexActiveRunsByBot, runStatusLabel } from "../run-state";
import { BotIcon, HashIcon, PlusIcon } from "./Icons";
import { RobotAvatar } from "./RobotAvatar";

interface SidebarProps {
  bots: Bot[];
  channels: Channel[];
  runs: Run[];
  ownerName: string;
  selectedChannelId?: string | undefined;
  selectedBotId?: string | undefined;
  onSelectChannel(channelId: string): void;
  onSelectBot(botId: string): void;
  onCreateBot(): void;
  onCreateChannel(): void;
  onLogout(): Promise<void>;
}

export function Sidebar({
  bots,
  channels,
  runs,
  ownerName,
  selectedChannelId,
  selectedBotId,
  onSelectChannel,
  onSelectBot,
  onCreateBot,
  onCreateChannel,
  onLogout,
}: SidebarProps) {
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
        OpenBot
      </a>

      <div className="sidebar-body">
        <SidebarSection title="频道" onAdd={onCreateChannel} addLabel="创建频道">
          {channels.length === 0 ? (
            <SidebarEmpty>还没有频道</SidebarEmpty>
          ) : (
            channels.map((channel) => (
              <button
                className={`sidebar-row ${selectedChannelId === channel.id ? "selected" : ""}`}
                key={channel.id}
                onClick={() => onSelectChannel(channel.id)}
                type="button"
              >
                <HashIcon />
                <span>{channel.name}</span>
                <small>{channel.botIds.length}</small>
              </button>
            ))
          )}
        </SidebarSection>

        <SidebarSection title="Bots" onAdd={onCreateBot} addLabel="创建 Bot">
          {bots.length === 0 ? (
            <SidebarEmpty>还没有 Bot</SidebarEmpty>
          ) : (
            bots.map((bot) => {
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

        <nav className="system-nav" aria-label="系统功能">
          <button type="button">
            <span className="system-nav-icon">◷</span>例行任务
          </button>
          <button type="button">
            <span className="system-nav-icon">⌁</span>技能
          </button>
          <button type="button">
            <span className="system-nav-icon">▣</span>节点
          </button>
          <button type="button">
            <span className="system-nav-icon">◇</span>审计
          </button>
        </nav>
      </div>

      <footer className="sidebar-owner">
        <span>
          <strong>{ownerName}</strong>
          <small className={logoutError ? "warning" : ""} role={logoutError ? "alert" : undefined}>
            {logoutError ? "退出失败，请重试" : "本地 Owner"}
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
