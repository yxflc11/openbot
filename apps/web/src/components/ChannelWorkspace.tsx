import type { Bot, Channel, Message } from "@openbot/domain";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { createMessage, listMessages } from "../api";
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messageError, setMessageError] = useState<string>();
  const [sending, setSending] = useState(false);
  const messageList = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setMessagesLoading(true);
    setMessageError(undefined);
    void listMessages(channel.id, controller.signal)
      .then((items) => setMessages(items))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setMessageError(cause instanceof Error ? cause.message : "无法读取本地消息。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setMessagesLoading(false);
      });
    return () => controller.abort();
  }, [channel.id]);

  useEffect(() => {
    if (messages.length > 0) {
      messageList.current?.scrollTo({ top: messageList.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

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

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = messageText.trim();
    if (content.length === 0 || sending) return;
    setSending(true);
    setMessageError(undefined);
    try {
      const message = await createMessage(channel.id, { content });
      setMessages((current) => [...current, message]);
      setMessageText("");
    } catch (cause) {
      setMessageError(cause instanceof Error ? cause.message : "消息未能保存。");
    } finally {
      setSending(false);
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

      <section className="conversation-panel" aria-label={`${channel.name} 消息`}>
        <div className="conversation-heading">
          <div>
            <h2>频道消息</h2>
            <p>消息保存在你自己的 PostgreSQL 中。</p>
          </div>
          <span>{messages.length} 条</span>
        </div>

        <div className="message-list" ref={messageList} aria-live="polite">
          {messagesLoading ? (
            <p className="conversation-status">正在读取本地消息…</p>
          ) : messages.length === 0 ? (
            <div className="conversation-empty">
              <span className="conversation-icon">
                <HashIcon />
              </span>
              <h2>{channel.name} 的起点</h2>
              <p>写下第一条任务，之后的对话和执行结果都会留在这里。</p>
            </div>
          ) : (
            messages.map((message) => (
              <article className={`message-row ${message.authorType}`} key={message.id}>
                <span className="message-author" aria-hidden="true">
                  {message.authorType === "human" ? "你" : "O"}
                </span>
                <div>
                  <header>
                    <strong>{message.authorType === "human" ? "你" : "OpenBot"}</strong>
                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                  </header>
                  <p>{message.content}</p>
                </div>
              </article>
            ))
          )}
        </div>

        <form className="message-composer" onSubmit={sendMessage}>
          <label htmlFor={`message-${channel.id}`}>给频道下任务</label>
          <div>
            <textarea
              id={`message-${channel.id}`}
              value={messageText}
              maxLength={8000}
              rows={2}
              placeholder="例如：打开测试页，填写表单但不要提交…"
              onChange={(event) => setMessageText(event.target.value)}
            />
            <button
              className="primary-button"
              type="submit"
              disabled={sending || messageText.trim().length === 0}
            >
              {sending ? "保存中…" : "发送"}
            </button>
          </div>
          {messageError ? <p className="composer-error">{messageError}</p> : null}
        </form>
      </section>
    </main>
  );
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
