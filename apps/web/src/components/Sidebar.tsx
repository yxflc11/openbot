import type { Bot, Channel } from "@openbot/domain";
import { useState } from "react";
import { BotIcon, HashIcon, OfficeIcon, PlusIcon } from "./Icons";
import { RobotAvatar } from "./RobotAvatar";

interface SidebarProps {
  bots: Bot[];
  channels: Channel[];
  ownerName: string;
  selectedChannelId?: string | undefined;
  onOffice(): void;
  onSelectChannel(channelId: string): void;
  onCreateBot(): void;
  onCreateChannel(): void;
  onLogout(): Promise<void>;
}

export function Sidebar({
  bots,
  channels,
  ownerName,
  selectedChannelId,
  onOffice,
  onSelectChannel,
  onCreateBot,
  onCreateChannel,
  onLogout,
}: SidebarProps) {
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

      <button
        className={`office-link ${selectedChannelId === undefined ? "active" : ""}`}
        type="button"
        onClick={onOffice}
      >
        <OfficeIcon />
        办公室
      </button>

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
            bots.map((bot) => (
              <div className="sidebar-row bot-row" key={bot.id}>
                <RobotAvatar bot={bot} compact />
                <span>{bot.name}</span>
                <small className="bot-state">
                  <span className="status-dot online" aria-hidden="true" />
                  待命
                </small>
              </div>
            ))
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
