import type { Artifact, Bot, Channel, Message, Run, RunFrame, RunProgress } from "@openbot/domain";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  createMessage,
  listMessages,
  listRuns,
  type RealtimeConnectionState,
  subscribeToChannelEvents,
} from "../api";
import { indexActiveRunsByBot, isActiveRun, mergeRuns, runStatusLabel } from "../run-state";
import { BotIcon, HashIcon } from "./Icons";
import { RobotAvatar } from "./RobotAvatar";

export function ChannelWorkspace({
  channel,
  bots,
  artifacts,
  progress,
  onJoin,
  onInspectRun,
  onFrame,
  onProgress,
  onRun,
}: {
  channel: Channel;
  bots: Bot[];
  artifacts: Artifact[];
  progress: RunProgress[];
  onJoin(botId: string): Promise<void>;
  onInspectRun(runId: string): void;
  onFrame(frame: RunFrame): void;
  onProgress(progress: RunProgress): void;
  onRun(run: Run, artifacts?: Artifact[]): void;
}) {
  const members = bots.filter((bot) => channel.botIds.includes(bot.id));
  const available = bots.filter((bot) => !channel.botIds.includes(bot.id));
  const botsById = new Map(bots.map((bot) => [bot.id, bot]));
  const artifactsByRun = new Map<string, Artifact[]>();
  for (const artifact of artifacts) {
    const items = artifactsByRun.get(artifact.runId) ?? [];
    items.push(artifact);
    artifactsByRun.set(artifact.runId, items);
  }
  const latestProgressByRun = new Map<string, RunProgress>();
  for (const item of progress) latestProgressByRun.set(item.runId, item);
  const [botId, setBotId] = useState(available[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [messageText, setMessageText] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messageError, setMessageError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("connecting");
  const messageList = useRef<HTMLDivElement>(null);
  const activeRunByBot = indexActiveRunsByBot(runs);

  useEffect(() => {
    const controller = new AbortController();
    let initialSync = true;
    const syncChannel = async () => {
      try {
        const [messageItems, runItems] = await Promise.all([
          listMessages(channel.id, controller.signal),
          listRuns(channel.id, controller.signal),
        ]);
        setMessages((current) => mergeMessages(messageItems, current));
        setRuns((current) => mergeRuns(runItems, current));
        for (const run of runItems) onRun(run);
        setMessageError(undefined);
      } catch (cause: unknown) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setMessageError(cause instanceof Error ? cause.message : "无法读取本地消息。");
      } finally {
        if (!controller.signal.aborted && initialSync) {
          initialSync = false;
          setMessagesLoading(false);
        }
      }
    };
    const unsubscribe = subscribeToChannelEvents(channel.id, {
      onMessage(message) {
        setMessages((current) => mergeMessages(current, [message]));
      },
      onFrame,
      onProgress,
      onRun(run, projectedArtifacts) {
        setRuns((current) => mergeRuns(current, [run]));
        onRun(run, projectedArtifacts);
      },
      onReady() {
        void syncChannel();
      },
      onState: setRealtimeState,
    });
    setMessagesLoading(true);
    setMessageError(undefined);
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [channel.id, onFrame, onProgress, onRun]);

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
      const result = await createMessage(channel.id, { content });
      setMessages((current) => mergeMessages(current, [result.message]));
      setRuns((current) => mergeRuns(current, [result.run]));
      onRun(result.run);
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
            {members.map((bot) => {
              const activeRun = activeRunByBot.get(bot.id);
              return (
                <article key={bot.id}>
                  <RobotAvatar bot={bot} compact status={activeRun?.status ?? bot.status} />
                  <div className="member-copy">
                    <strong>{bot.name}</strong>
                    <span className="member-role">{bot.role}</span>
                  </div>
                  <small className={activeRun ? "active" : ""}>
                    {activeRun ? runStatusLabel(activeRun.status) : "待命"}
                  </small>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="conversation-panel" aria-label={`${channel.name} 消息`}>
        <div className="conversation-heading">
          <div>
            <h2>频道消息</h2>
            <p>消息保存在你自己的 PostgreSQL 中。</p>
          </div>
          <div className="realtime-summary">
            <span>最近 {messages.length} 条</span>
            <span className={`realtime-state ${realtimeState}`}>
              <i />
              {realtimeLabel(realtimeState)}
            </span>
          </div>
        </div>

        {runs.length > 0 ? (
          <section className="run-queue" aria-label="频道任务">
            <header>
              <h3>任务</h3>
              <span>{runs.filter(isActiveRun).length} 个处理中</span>
            </header>
            <div>
              {runs.slice(0, 5).map((run) => {
                const assignee = botsById.get(run.botId);
                const runArtifacts = artifactsByRun.get(run.id) ?? [];
                const latestProgress = latestProgressByRun.get(run.id);
                return (
                  <article className="run-row-shell" key={run.id}>
                    <button
                      className="run-row"
                      type="button"
                      aria-label={`查看任务：${run.title}`}
                      onClick={() => onInspectRun(run.id)}
                    >
                      {assignee ? <RobotAvatar bot={assignee} compact status={run.status} /> : null}
                      <span className="run-row-copy">
                        <strong>{run.title}</strong>
                        <small>{latestProgress?.message ?? assignee?.name ?? "未知 Bot"}</small>
                      </span>
                      <span className={`run-status ${run.status}`}>
                        {runStatusLabel(run.status)}
                      </span>
                    </button>
                    {run.resultSummary || run.errorMessage || runArtifacts.length > 0 ? (
                      <div className={`run-result ${run.errorMessage ? "failed" : ""}`}>
                        <p>{run.errorMessage ?? run.resultSummary}</p>
                        {runArtifacts.map((artifact) => (
                          <a
                            href={`/api/v1/artifacts/${artifact.id}/content`}
                            target="_blank"
                            rel="noreferrer"
                            key={artifact.id}
                          >
                            <img
                              src={`/api/v1/artifacts/${artifact.id}/content`}
                              alt={artifact.name}
                              loading="lazy"
                            />
                            <span>{artifact.name}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

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
              disabled={members.length === 0}
              placeholder={
                members.length === 0
                  ? "先把一名 Bot 加入频道"
                  : "例如：打开测试页，填写表单但不要提交…"
              }
              onChange={(event) => setMessageText(event.target.value)}
            />
            <button
              className="primary-button"
              type="submit"
              disabled={sending || members.length === 0 || messageText.trim().length === 0}
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

function mergeMessages(primary: Message[], secondary: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const message of [...primary, ...secondary]) byId.set(message.id, message);
  return Array.from(byId.values())
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-200);
}

function realtimeLabel(state: RealtimeConnectionState) {
  const labels: Record<RealtimeConnectionState, string> = {
    connecting: "连接中",
    live: "实时",
    retrying: "重连中",
  };
  return labels[state];
}
