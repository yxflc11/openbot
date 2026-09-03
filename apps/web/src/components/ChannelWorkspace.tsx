import type { Artifact, Bot, Channel, Message, Run, RunFrame, RunProgress } from "@openbot/domain";
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createMessage,
  listMessages,
  listRuns,
  type RealtimeConnectionState,
  subscribeToChannelEvents,
} from "../api";
import { indexActiveRunsByBot, isActiveRun, mergeRuns, runStatusLabel } from "../run-state";
import { HashIcon, PlusIcon } from "./Icons";
import { RichMessage } from "./RichMessage";
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
  const botsById = useMemo(() => new Map(bots.map((bot) => [bot.id, bot])), [bots]);
  const [joinBotId, setJoinBotId] = useState(available[0]?.id ?? "");
  const [targetBotId, setTargetBotId] = useState(members[0]?.id ?? "");
  const [joining, setJoining] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [messageText, setMessageText] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message>();
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messageError, setMessageError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("connecting");
  const messageList = useRef<HTMLDivElement>(null);
  const activeRunByBot = indexActiveRunsByBot(runs);
  const activeRuns = runs.filter(isActiveRun);
  const messageById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );
  const artifactsByRun = useMemo(() => {
    const result = new Map<string, Artifact[]>();
    for (const artifact of artifacts) {
      const items = result.get(artifact.runId) ?? [];
      items.push(artifact);
      result.set(artifact.runId, items);
    }
    return result;
  }, [artifacts]);
  const latestProgressByRun = useMemo(() => {
    const result = new Map<string, RunProgress>();
    for (const item of progress) result.set(item.runId, item);
    return result;
  }, [progress]);

  useEffect(() => {
    if (!members.some((bot) => bot.id === targetBotId)) setTargetBotId(members[0]?.id ?? "");
    if (!available.some((bot) => bot.id === joinBotId)) setJoinBotId(available[0]?.id ?? "");
  }, [available, joinBotId, members, targetBotId]);

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
    setMessages([]);
    setRuns([]);
    setReplyingTo(undefined);
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

  async function joinSelectedBot() {
    if (joinBotId.length === 0 || joining) return;
    setJoining(true);
    try {
      await onJoin(joinBotId);
    } finally {
      setJoining(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = messageText.trim();
    if (content.length === 0 || sending || targetBotId.length === 0) return;
    setSending(true);
    setMessageError(undefined);
    try {
      const result = await createMessage(channel.id, {
        content,
        botId: targetBotId,
        ...(replyingTo === undefined ? {} : { replyToMessageId: replyingTo.id }),
      });
      setMessages((current) => mergeMessages(current, [result.message]));
      setRuns((current) => mergeRuns(current, [result.run]));
      onRun(result.run);
      setMessageText("");
      setReplyingTo(undefined);
    } catch (cause) {
      setMessageError(cause instanceof Error ? cause.message : "消息未能保存。");
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  const targetBot = botsById.get(targetBotId);
  return (
    <main className="workspace-main channel-workspace">
      <header className="channel-conversation-header">
        <div className="channel-identity">
          <span className="channel-title-icon">
            <HashIcon />
          </span>
          <div>
            <h1>{channel.name}</h1>
            <p>{channel.description || "长期任务与 Bot 对话"}</p>
          </div>
        </div>
        <div className="channel-team-summary">
          <div className="member-stack" title={`${members.length} 名 Bot`}>
            {members.slice(0, 4).map((bot) => (
              <RobotAvatar
                bot={bot}
                compact
                status={activeRunByBot.get(bot.id)?.status ?? bot.status}
                key={bot.id}
              />
            ))}
            {members.length > 4 ? <span>+{members.length - 4}</span> : null}
          </div>
          {available.length > 0 ? (
            <div className="join-control compact-join-control">
              <select
                aria-label="选择要加入频道的 Bot"
                value={joinBotId}
                onChange={(event) => setJoinBotId(event.target.value)}
              >
                {available.map((bot) => (
                  <option value={bot.id} key={bot.id}>
                    {bot.name}
                  </option>
                ))}
              </select>
              <button
                className="icon-button"
                type="button"
                disabled={joining}
                onClick={() => void joinSelectedBot()}
                aria-label="加入频道"
              >
                <PlusIcon />
              </button>
            </div>
          ) : null}
          <span className={`realtime-state ${realtimeState}`}>
            <i />
            {realtimeLabel(realtimeState)}
          </span>
        </div>
      </header>

      <section
        className="conversation-panel channel-conversation"
        aria-label={`${channel.name} 消息`}
      >
        {activeRuns.length > 0 ? (
          <section className="active-run-strip" aria-label="正在执行的任务">
            {activeRuns.slice(0, 3).map((run) => {
              const assignee = botsById.get(run.botId);
              return (
                <button type="button" onClick={() => onInspectRun(run.id)} key={run.id}>
                  {assignee ? <RobotAvatar bot={assignee} compact status={run.status} /> : null}
                  <span>
                    <strong>
                      {assignee?.name ?? "Bot"} · {runStatusLabel(run.status)}
                    </strong>
                    <small>{latestProgressByRun.get(run.id)?.message ?? run.title}</small>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              );
            })}
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
              <h2>{channel.name} 的第一条消息</h2>
              <p>
                {members.length === 0
                  ? "先将一名 Bot 加入频道。"
                  : "选择一名 Bot，直接交代第一件工作。"}
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const author =
                message.authorId === undefined ? undefined : botsById.get(message.authorId);
              const replyTarget =
                message.replyToMessageId === undefined
                  ? undefined
                  : messageById.get(message.replyToMessageId);
              const run =
                message.runId === undefined
                  ? undefined
                  : runs.find((item) => item.id === message.runId);
              const messageArtifacts =
                message.runId === undefined ? [] : (artifactsByRun.get(message.runId) ?? []);
              return (
                <MessageRow
                  message={message}
                  author={author}
                  replyTarget={replyTarget}
                  botsById={botsById}
                  artifacts={messageArtifacts}
                  run={run}
                  onReply={() => setReplyingTo(message)}
                  onInspectRun={onInspectRun}
                  key={message.id}
                />
              );
            })
          )}
        </div>

        <form className="message-composer" onSubmit={sendMessage}>
          {replyingTo ? (
            <div className="composer-reply">
              <span>回复 {messageAuthorName(replyingTo, botsById)}</span>
              <p>{replyingTo.content}</p>
              <button type="button" onClick={() => setReplyingTo(undefined)} aria-label="取消回复">
                ×
              </button>
            </div>
          ) : null}
          <div className="composer-target">
            <span>发送给</span>
            <select
              value={targetBotId}
              disabled={members.length === 0}
              onChange={(event) => setTargetBotId(event.target.value)}
              aria-label="选择接收任务的 Bot"
            >
              {members.map((bot) => (
                <option value={bot.id} key={bot.id}>
                  {bot.name}
                </option>
              ))}
            </select>
          </div>
          <div className="composer-input-row">
            <textarea
              id={`message-${channel.id}`}
              value={messageText}
              maxLength={8000}
              rows={1}
              disabled={members.length === 0}
              placeholder={
                members.length === 0
                  ? "先把一名 Bot 加入频道"
                  : `给 ${targetBot?.name ?? "Bot"} 发消息`
              }
              onChange={(event) => setMessageText(event.target.value)}
              onKeyDown={handleComposerKeyDown}
            />
            <button
              className="composer-send"
              type="submit"
              disabled={sending || members.length === 0 || messageText.trim().length === 0}
              aria-label="发送消息"
            >
              {sending ? "…" : "↑"}
            </button>
          </div>
          {messageError ? <p className="composer-error">{messageError}</p> : null}
        </form>
      </section>
    </main>
  );
}

function MessageRow({
  message,
  author,
  replyTarget,
  botsById,
  artifacts,
  run,
  onReply,
  onInspectRun,
}: {
  message: Message;
  author: Bot | undefined;
  replyTarget: Message | undefined;
  botsById: Map<string, Bot>;
  artifacts: Artifact[];
  run: Run | undefined;
  onReply(): void;
  onInspectRun(runId: string): void;
}) {
  const name = message.authorType === "human" ? "你" : (author?.name ?? "OpenBot");
  return (
    <article className={`message-row ${message.authorType}`}>
      <div className="message-avatar">
        {author ? (
          <RobotAvatar bot={author} compact status={run?.status ?? author.status} />
        ) : (
          <span>{message.authorType === "human" ? "你" : "O"}</span>
        )}
      </div>
      <div className="message-content">
        <header>
          <strong>{name}</strong>
          <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
        </header>
        {replyTarget ? (
          <blockquote>
            {messageAuthorName(replyTarget, botsById)}：{replyTarget.content}
          </blockquote>
        ) : null}
        <RichMessage content={message.content} />
        {artifacts.length > 0 ? (
          <div className="message-artifacts">
            {artifacts.map((artifact) => (
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
        <div className="message-actions">
          <button type="button" onClick={onReply}>
            ↩ 回复
          </button>
          {run ? (
            <button type="button" onClick={() => onInspectRun(run.id)}>
              任务详情 ↗
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function messageAuthorName(message: Message, botsById: Map<string, Bot> = new Map()) {
  if (message.authorType === "human") return "你";
  return (
    (message.authorId === undefined ? undefined : botsById.get(message.authorId)?.name) ?? "OpenBot"
  );
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
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
