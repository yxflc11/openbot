import type { Bot, Channel } from "@openbot/domain";
import { useState } from "react";
import { BotIcon, HashIcon } from "./Icons";
import { RobotAvatar } from "./RobotAvatar";

export function ChannelWorkspace({
  channel,
  bots,
  onJoin,
}: {
  channel: Channel;
  bots: Bot[];
  onJoin(botId: string): Promise<void>;
}) {
  const members = bots.filter((bot) => channel.botIds.includes(bot.id));
  const available = bots.filter((bot) => !channel.botIds.includes(bot.id));
  const [botId, setBotId] = useState(available[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (botId.length === 0) return;
    setBusy(true);
    try {
      await onJoin(botId);
      setBotId(available.find((bot) => bot.id !== botId)?.id ?? "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workspace-main channel-workspace">
      <header className="workspace-header channel-header">
        <div className="channel-title-icon">
          <HashIcon />
        </div>
        <div>
          <h1>{channel.name}</h1>
          <p>{channel.description || "这个频道还没有工作目标。"}</p>
        </div>
      </header>

      <section className="channel-panel">
        <div className="channel-panel-heading">
          <div>
            <h2>频道团队</h2>
            <p>加入这里的 Bot 才能接收该频道的任务。</p>
          </div>
          {available.length > 0 ? (
            <div className="join-control">
              <select
                aria-label="选择 Bot"
                value={botId}
                onChange={(event) => setBotId(event.target.value)}
              >
                {available.map((bot) => (
                  <option value={bot.id} key={bot.id}>
                    {bot.name}
                  </option>
                ))}
              </select>
              <button className="secondary-button" type="button" disabled={busy} onClick={submit}>
                {busy ? "加入中…" : "加入频道"}
              </button>
            </div>
          ) : null}
        </div>

        {members.length === 0 ? (
          <div className="channel-empty">
            <BotIcon />
            <h3>还没有 Bot</h3>
            <p>从上方选择一个 Bot 加入频道。</p>
          </div>
        ) : (
          <div className="member-list">
            {members.map((bot) => (
              <article key={bot.id}>
                <RobotAvatar bot={bot} compact />
                <div className="member-copy">
                  <strong>{bot.name}</strong>
                  <span className="member-role">{bot.role}</span>
                </div>
                <small>待命</small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="conversation-empty">
        <span className="conversation-icon">
          <HashIcon />
        </span>
        <h2>{channel.name} 的起点</h2>
        <p>本地消息与任务时间线将在下一个 M0 切片接入这里。</p>
      </section>
    </main>
  );
}
