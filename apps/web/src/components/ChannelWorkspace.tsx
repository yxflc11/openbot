import type { Artifact, Bot, Channel, Message, Run, RunFrame, RunProgress } from "@openbot/domain";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  createMessage,
  listMessages,
  listRuns,
  type RealtimeConnectionState,
  subscribeToChannelEvents,
} from "../api";
import { type ConversationSession, createConversationSession } from "../conversation-session";
import { isActiveRun, runStatusLabel } from "../run-state";
import { useWorkspacePreferences } from "../workspace-preferences";
import { ChannelMembersMenu } from "./ChannelMembersMenu";
import { HashIcon, SendIcon } from "./Icons";
import { OpenBotMark } from "./OpenBotMark";
import { RichMessage } from "./RichMessage";
import { RobotAvatar } from "./RobotAvatar";

export function ChannelWorkspace({
  headerAction,
  globalHeader = false,
  session: suppliedSession,
  channel,
  bots,
  artifacts,
  progress,
  onJoin,
  onInspectRun,
  onOpenBot,
  onFrame,
  onProgress,
  onRun,
}: {
  headerAction?: ReactNode;
  globalHeader?: boolean;
  session?: ConversationSession;
  channel: Channel;
  bots: Bot[];
  artifacts: Artifact[];
  progress: RunProgress[];
  onJoin(botId: string): Promise<void>;
  onInspectRun(runId: string): void;
  onOpenBot(botId: string): void;
  onFrame(frame: RunFrame): void;
  onProgress(progress: RunProgress): void;
  onRun(run: Run, artifacts?: Artifact[]): void;
}) {
  const { values: preferences } = useWorkspacePreferences();
  const [ownSession] = useState(createConversationSession);
  const session = suppliedSession ?? ownSession;
  const firstMemberId = channel.botIds.find((id) => bots.some((bot) => bot.id === id)) ?? "";
  const conversation = useMemo(
    () => session.channel(channel.id, firstMemberId),
    [session, channel.id, firstMemberId],
  );
  const state = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
    conversation.getSnapshot,
  );
  const { messages, runs, draft, loading, loadError, sendError, sending, capacityError } = state;
  const members = bots.filter((bot) => channel.botIds.includes(bot.id));
  const botsById = useMemo(() => new Map(bots.map((bot) => [bot.id, bot])), [bots]);
  const messageById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );
  const runsById = useMemo(() => new Map(runs.map((run) => [run.id, run])), [runs]);
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("connecting");
  const [readAttempt, setReadAttempt] = useState(0);
  const [awayFromLatest, setAwayFromLatest] = useState(!conversation.scroll.atBottom);
  const messageList = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const restored = useRef(false);
  const viewportSize = useRef({ width: 0, height: 0 });
  const mounted = useRef(false);
  const targetBot = botsById.get(draft.targetBotId);
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
  const unlinkedRuns = runs.filter(
    (run) => isActiveRun(run) && !messages.some((message) => message.runId === run.id),
  );

  useEffect(() => {
    if (!channel.botIds.includes(draft.targetBotId) || !botsById.has(draft.targetBotId)) {
      if (draft.targetBotId !== firstMemberId) conversation.edit({ targetBotId: firstMemberId });
    }
  }, [conversation, channel.botIds, botsById, draft.targetBotId, firstMemberId]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a user retry deliberately restarts this bounded subscription/read lifecycle.
  useEffect(() => {
    const controller = new AbortController();
    let revision = 0;
    const syncChannel = async () => {
      const requestedRevision = ++revision;
      try {
        const [messageItems, runItems] = await Promise.all([
          listMessages(channel.id, controller.signal),
          listRuns(channel.id, controller.signal),
        ]);
        if (controller.signal.aborted || requestedRevision !== revision) return;
        conversation.merge(messageItems, runItems);
        conversation.loaded();
        for (const run of runItems) if (run.channelId === channel.id) onRun(run);
      } catch (cause: unknown) {
        if (controller.signal.aborted || requestedRevision !== revision) return;
        conversation.loaded(cause instanceof Error ? cause.message : "无法读取频道消息。");
      }
    };
    const unsubscribe = subscribeToChannelEvents(channel.id, {
      onMessage(message) {
        if (!controller.signal.aborted) conversation.merge([message]);
      },
      onFrame(frame) {
        if (!controller.signal.aborted) onFrame(frame);
      },
      onProgress(item) {
        if (!controller.signal.aborted) onProgress(item);
      },
      onRun(run, projectedArtifacts) {
        if (controller.signal.aborted || run.channelId !== channel.id) return;
        conversation.merge([], [run]);
        onRun(run, projectedArtifacts);
      },
      onReady() {
        if (!controller.signal.aborted) void syncChannel();
      },
      onState(value) {
        if (!controller.signal.aborted) setRealtimeState(value);
      },
    });
    void syncChannel();
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [channel.id, conversation, onFrame, onProgress, onRun, readAttempt]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: message count changes invalidate DOM scroll geometry.
  useLayoutEffect(() => {
    const list = messageList.current;
    if (!list || loading || list.clientHeight === 0) return;
    if (!restored.current) {
      list.scrollTop = conversation.scroll.atBottom ? list.scrollHeight : conversation.scroll.top;
      restored.current = true;
    } else if (conversation.scroll.atBottom) {
      list.scrollTo?.({
        top: list.scrollHeight,
        behavior:
          preferences.reduceMotion ||
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
      });
    }
  }, [conversation, loading, messages.length, preferences.reduceMotion]);

  useLayoutEffect(() => {
    const list = messageList.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    viewportSize.current = { width: list.clientWidth, height: list.clientHeight };
    const observer = new ResizeObserver(() => {
      viewportSize.current = { width: list.clientWidth, height: list.clientHeight };
      if (list.clientHeight === 0) return;
      const snapshot = conversation.getSnapshot();
      if (snapshot.loading && snapshot.messages.length === 0) return;
      // Resizing a sidebar, composer or window must preserve the user's existing follow intent.
      list.scrollTop = conversation.scroll.atBottom ? list.scrollHeight : conversation.scroll.top;
      conversation.scroll.top = list.scrollTop;
      conversation.scroll.atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
      setAwayFromLatest(!conversation.scroll.atBottom);
      restored.current = true;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [conversation]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: textarea value and font changes invalidate measured content height.
  useLayoutEffect(() => {
    const input = textarea.current;
    if (!input) return;
    const resize = () => {
      const style = window.getComputedStyle(input);
      const lineHeight = Number.parseFloat(style.lineHeight) || 24;
      const padding =
        (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
      input.style.height = "auto";
      input.style.height = `${Math.max(2 * lineHeight + padding, Math.min(input.scrollHeight, 8 * lineHeight + padding))}px`;
    };
    resize();
    let width = input.clientWidth;
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            if (input.clientWidth !== width) {
              width = input.clientWidth;
              resize();
            }
          });
    observer?.observe(input);
    return () => observer?.disconnect();
  }, [draft.text, preferences.fontSize]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || !members.some((bot) => bot.id === draft.targetBotId)) return;
    const result = await conversation.send((input) => createMessage(channel.id, input));
    if (result && mounted.current) onRun(result.run);
  }
  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229 ||
      event.altKey
    )
      return;
    if (preferences.sendShortcut === "modifier" && !event.metaKey && !event.ctrlKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
  function showLatest() {
    conversation.scroll.atBottom = true;
    const list = messageList.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
      conversation.scroll.top = list.scrollTop;
    }
    setAwayFromLatest(false);
  }
  return (
    <main
      className={`workspace-main channel-workspace conversation-round-one${globalHeader ? " has-global-header" : ""}`}
    >
      {!globalHeader ? (
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
            <ChannelMembersMenu
              channel={channel}
              bots={bots}
              onJoin={onJoin}
              onOpenBot={onOpenBot}
            />
            {headerAction}
          </div>
        </header>
      ) : null}
      <section
        className="conversation-panel channel-conversation"
        aria-label={`${channel.name} 消息`}
      >
        {loadError ? (
          <div className="conversation-load-error" role="alert">
            <span>{loadError}</span>
            <button type="button" onClick={() => setReadAttempt((value) => value + 1)}>
              重新读取
            </button>
          </div>
        ) : null}
        <div
          className="message-list"
          ref={messageList}
          onScroll={(event) => {
            const list = event.currentTarget;
            // Hidden settings content has zero geometry; it must not erase the saved reading position.
            if (list.clientHeight === 0) return;
            if (
              typeof ResizeObserver !== "undefined" &&
              (list.clientWidth !== viewportSize.current.width ||
                list.clientHeight !== viewportSize.current.height)
            )
              return;
            conversation.scroll.top = list.scrollTop;
            conversation.scroll.atBottom =
              list.scrollHeight - list.scrollTop - list.clientHeight < 80;
            setAwayFromLatest(!conversation.scroll.atBottom);
          }}
          role="log"
          aria-label="频道消息记录"
          aria-live="polite"
        >
          {loading && messages.length === 0 ? (
            <p className="conversation-status">正在读取频道消息…</p>
          ) : messages.length === 0 ? (
            <div className="conversation-empty">
              <span className="conversation-icon">
                <HashIcon />
              </span>
              <h2>{channel.name} 的第一条消息</h2>
              <p>
                {members.length === 0
                  ? "先从顶部菜单添加一名 Bot。"
                  : "选择一名 Bot，直接交代第一件工作。"}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                author={message.authorId === undefined ? undefined : botsById.get(message.authorId)}
                replyTarget={
                  message.replyToMessageId === undefined
                    ? undefined
                    : messageById.get(message.replyToMessageId)
                }
                botsById={botsById}
                artifacts={
                  message.runId === undefined ? [] : (artifactsByRun.get(message.runId) ?? [])
                }
                run={message.runId === undefined ? undefined : runsById.get(message.runId)}
                progress={
                  message.runId === undefined ? undefined : latestProgressByRun.get(message.runId)
                }
                onReply={() => {
                  conversation.edit({ replyTo: message });
                  textarea.current?.focus();
                }}
                onInspectRun={onInspectRun}
                onOpenBot={onOpenBot}
              />
            ))
          )}
          {unlinkedRuns.length > 0 ? (
            <section className="unlinked-run-status" aria-label="其他正在执行的任务">
              {unlinkedRuns.map((run) => (
                <button type="button" key={run.id} onClick={() => onInspectRun(run.id)}>
                  <strong>
                    {botsById.get(run.botId)?.name ?? "Bot"} · {runStatusLabel(run.status)}
                  </strong>
                  <span>{latestProgressByRun.get(run.id)?.message ?? run.title}</span>
                </button>
              ))}
            </section>
          ) : null}
        </div>
        {awayFromLatest ? (
          <button type="button" className="conversation-latest" onClick={showLatest}>
            ↓ 回到最新
          </button>
        ) : null}
        {capacityError ? (
          <p className="conversation-capacity-error" role="alert">
            {capacityError}
          </p>
        ) : null}
        <form className="message-composer" onSubmit={sendMessage}>
          {draft.replyTo ? (
            <div className="composer-reply">
              <span>回复 {messageAuthorName(draft.replyTo, botsById)}</span>
              <p>{draft.replyTo.content}</p>
              <button
                type="button"
                onClick={() => conversation.edit({ replyTo: undefined })}
                aria-label="取消回复"
              >
                ×
              </button>
            </div>
          ) : null}
          <textarea
            ref={textarea}
            id={`message-${channel.id}`}
            aria-label="消息内容"
            value={draft.text}
            maxLength={8000}
            rows={2}
            disabled={members.length === 0 || Boolean(capacityError)}
            placeholder={
              members.length === 0
                ? "先从顶部菜单添加一名 Bot"
                : `给 ${targetBot?.name ?? "Bot"} 发消息`
            }
            onChange={(event) => conversation.edit({ text: event.target.value })}
            onKeyDown={handleComposerKeyDown}
          />
          <div className="composer-toolbar">
            <div className="composer-bot-chip">
              {targetBot ? <RobotAvatar bot={targetBot} compact /> : <HashIcon />}
              <select
                value={draft.targetBotId}
                disabled={members.length === 0 || Boolean(capacityError)}
                onChange={(event) => conversation.edit({ targetBotId: event.target.value })}
                aria-label="选择接收任务的 Bot"
              >
                {members.length === 0 ? (
                  <option value="">选择 Bot</option>
                ) : (
                  members.map((bot) => (
                    <option value={bot.id} key={bot.id}>
                      {bot.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <button
              className="composer-send"
              type="submit"
              disabled={
                sending || Boolean(capacityError) || members.length === 0 || !draft.text.trim()
              }
              aria-label="发送消息"
              title={
                preferences.sendShortcut === "modifier" ? "⌘ / Ctrl + Enter 发送" : "Enter 发送"
              }
            >
              {sending ? <span aria-hidden="true">…</span> : <SendIcon />}
            </button>
          </div>
          {sending ? (
            <p className="composer-pending" role="status">
              正在发送，你可以继续起草下一条。
            </p>
          ) : null}
          {sendError ? (
            <p className="composer-error" role="alert">
              {sendError}
            </p>
          ) : null}
        </form>
        <div className="conversation-footer">
          <span>
            {preferences.sendShortcut === "modifier"
              ? "⌘ / Ctrl + Enter 发送 · Enter 换行"
              : "Enter 发送 · Shift + Enter 换行"}
          </span>
          <span className={`realtime-state ${realtimeState}`}>
            <i />
            {realtimeLabel(realtimeState)}
          </span>
        </div>
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
  progress,
  onReply,
  onInspectRun,
  onOpenBot,
}: {
  message: Message;
  author: Bot | undefined;
  replyTarget: Message | undefined;
  botsById: Map<string, Bot>;
  artifacts: Artifact[];
  run: Run | undefined;
  progress: RunProgress | undefined;
  onReply(): void;
  onInspectRun(runId: string): void;
  onOpenBot(botId: string): void;
}) {
  const { values: preferences } = useWorkspacePreferences();
  const name = message.authorType === "human" ? "你" : (author?.name ?? "OpenBot");
  return (
    <article className={`message-row ${message.authorType}`}>
      <div className="message-avatar">
        {author ? (
          <button
            type="button"
            aria-label={`打开 ${author.name} 的员工档案`}
            onClick={() => onOpenBot(author.id)}
          >
            <RobotAvatar bot={author} compact status={run?.status ?? author.status} />
          </button>
        ) : message.authorType === "human" ? (
          <span>你</span>
        ) : (
          <OpenBotMark />
        )}
      </div>
      <div className="message-content">
        <header>
          <strong>{name}</strong>
          <time dateTime={message.createdAt}>
            {formatMessageTime(message.createdAt, preferences.hour12)}
          </time>
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
        {run ? (
          <button
            className={`message-run-status ${run.status}`}
            type="button"
            onClick={() => onInspectRun(run.id)}
          >
            <span className="run-status-dot" aria-hidden="true" />
            <strong>{runStatusLabel(run.status)}</strong>
            <span>{progress?.message ?? run.title}</span>
            <span aria-hidden="true">›</span>
          </button>
        ) : null}
        <div className="message-actions">
          <button type="button" onClick={onReply}>
            ↩ 回复
          </button>
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

function formatMessageTime(value: string, hour12: boolean) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12 }).format(
    new Date(value),
  );
}

function realtimeLabel(state: RealtimeConnectionState) {
  const labels: Record<RealtimeConnectionState, string> = {
    connecting: "连接中",
    live: "实时连接",
    retrying: "正在重连",
  };
  return labels[state];
}
