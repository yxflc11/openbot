import type { Bot, Channel } from "@openbot/domain";
import { PlusIcon } from "./Icons";
import { RobotAvatar } from "./RobotAvatar";

interface OfficeProps {
  bots: Bot[];
  channels: Channel[];
  onCreateBot(): void;
  onCreateChannel(): void;
}

export function Office({ bots, channels, onCreateBot, onCreateChannel }: OfficeProps) {
  return (
    <main className="workspace-main">
      <header className="workspace-header">
        <div>
          <h1>OpenBot 办公室</h1>
          <p>你的数字员工与可替换电脑，都在这里。</p>
        </div>
        <div className="header-actions">
          <button className="primary-button" type="button" onClick={onCreateChannel}>
            <PlusIcon />
            创建频道
          </button>
          <button className="secondary-button" type="button" onClick={onCreateBot}>
            创建 Bot
          </button>
        </div>
      </header>

      <section className="office-canvas" aria-label="Bot 办公室">
        <div className="office-room" aria-hidden="true">
          <span className="window-line one" />
          <span className="window-line two" />
          <span className="plant">⌇</span>
        </div>
        <div className="stations">
          {bots.slice(0, 3).map((bot) => (
            <BotStation bot={bot} key={bot.id} />
          ))}
          {bots.length < 4 ? (
            <button className="empty-station" type="button" onClick={onCreateBot}>
              <span className="empty-station-icon">
                <PlusIcon />
              </span>
              <strong>添加 Bot</strong>
              <small>创建一名新的数字员工</small>
            </button>
          ) : null}
        </div>
      </section>

      {bots.length === 0 ? (
        <section className="first-run">
          <div>
            <h2>先创建你的第一名数字员工</h2>
            <p>建议从 Ops 开始。创建后，再建立频道并把它加入团队。</p>
          </div>
          <button className="primary-button" type="button" onClick={onCreateBot}>
            创建第一个 Bot
          </button>
        </section>
      ) : channels.length === 0 ? (
        <section className="first-run">
          <div>
            <h2>Bot 已就位，下一步创建频道</h2>
            <p>频道保存长期上下文、团队成员和之后的任务历史。</p>
          </div>
          <button className="primary-button" type="button" onClick={onCreateChannel}>
            创建第一个频道
          </button>
        </section>
      ) : null}
    </main>
  );
}

function BotStation({ bot }: { bot: Bot }) {
  const status = bot.computerProfile === "none" ? "未连接电脑" : "待命";
  return (
    <article className="bot-station">
      <div className="station-visual">
        <RobotAvatar bot={bot} />
        <span className="desk-screen" aria-hidden="true" />
      </div>
      <div className="station-meta">
        <div className="station-name">
          <span className={`status-dot ${status === "待命" ? "online" : "warning"}`} />
          <strong>{bot.name}</strong>
        </div>
        <span className={status === "待命" ? "status-text" : "status-text warning"}>{status}</span>
        <dl>
          <dt>绑定电脑</dt>
          <dd>{profileLabel(bot.computerProfile)}</dd>
        </dl>
      </div>
    </article>
  );
}

function profileLabel(profile: Bot["computerProfile"]) {
  const labels: Record<Bot["computerProfile"], string> = {
    none: "—",
    "docker-linux": "Docker Linux",
    "macos-cua": "macOS Cua",
    "lume-vm": "Lume VM",
    coder: "Coder runtime",
  };
  return labels[profile];
}
