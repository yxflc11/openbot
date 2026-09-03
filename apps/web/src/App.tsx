import type {
  Artifact,
  AuthSessionSnapshot,
  CreateBotInput,
  CreateChannelInput,
  Run,
  RunProgress,
  WorkspaceSnapshot,
} from "@openbot/domain";
import { useCallback, useEffect, useState } from "react";
import {
  createBot,
  createChannel,
  getAuthSession,
  getWorkspace,
  joinBotToChannel,
  login,
  logout,
  type RealtimeConnectionState,
  subscribeToUnauthorized,
  subscribeToWorkspaceEvents,
} from "./api";
import { ChannelWorkspace } from "./components/ChannelWorkspace";
import { ContextRail } from "./components/ContextRail";
import { CreateBotDialog } from "./components/CreateBotDialog";
import { CreateChannelDialog } from "./components/CreateChannelDialog";
import { LoginScreen } from "./components/LoginScreen";
import { type MobilePanel, MobileNavigation } from "./components/MobileNavigation";
import { Office } from "./components/Office";
import { RunInspector } from "./components/RunInspector";
import { Sidebar } from "./components/Sidebar";
import {
  isActiveRun,
  mergeArtifacts,
  mergeNodes,
  mergeProgress,
  mergeRuns,
  projectRunOnNodes,
} from "./run-state";

type Dialog = "bot" | "channel" | undefined;

export function App() {
  const [session, setSession] = useState<AuthSessionSnapshot>();
  const [sessionError, setSessionError] = useState<string>();

  const refreshSession = useCallback(async (signal?: AbortSignal) => {
    setSessionError(undefined);
    try {
      setSession(await getAuthSession(signal));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setSessionError(
        cause instanceof Error ? cause.message : "无法连接 OpenBot Server。请确认服务已启动。",
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refreshSession(controller.signal);
    return () => controller.abort();
  }, [refreshSession]);

  useEffect(() => subscribeToUnauthorized(() => setSession({ authenticated: false })), []);

  useEffect(() => {
    if (session?.authenticated !== true) return;
    const remainingMs = new Date(session.expiresAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      setSession({ authenticated: false });
      return;
    }
    const timer = window.setTimeout(
      () => setSession({ authenticated: false }),
      Math.min(remainingMs, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [session]);

  if (session === undefined) {
    return (
      <main className="loading-screen">
        <span className="loading-mark">O</span>
        <h1>{sessionError ? "无法打开 OpenBot" : "正在验证本地会话"}</h1>
        <p>{sessionError ?? "正在安全连接你的 OpenBot Server…"}</p>
        {sessionError ? (
          <button className="primary-button" type="button" onClick={() => refreshSession()}>
            重新连接
          </button>
        ) : null}
      </main>
    );
  }

  if (!session.authenticated) {
    return <LoginScreen onLogin={async (password) => setSession(await login(password))} />;
  }

  return (
    <AuthenticatedWorkspace
      ownerName={session.owner.name}
      onLogout={async () => {
        await logout();
        setSession({ authenticated: false });
      }}
    />
  );
}

function AuthenticatedWorkspace({
  ownerName,
  onLogout,
}: {
  ownerName: string;
  onLogout(): Promise<void>;
}) {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>();
  const [selectedChannelId, setSelectedChannelId] = useState<string>();
  const [dialog, setDialog] = useState<Dialog>();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [workspaceRealtimeState, setWorkspaceRealtimeState] =
    useState<RealtimeConnectionState>("connecting");
  const closeInspector = useCallback(() => setSelectedRunId(undefined), []);

  const projectRun = useCallback((run: Run, artifacts: Artifact[] = []) => {
    setWorkspace((current) => {
      if (current === undefined) return current;
      const previous = current.runs.find((item) => item.id === run.id);
      const runs = mergeRuns(current.runs, [run]);
      const projected = runs.find((item) => item.id === run.id) ?? run;
      const activeRunDelta =
        Number(isActiveRun(projected)) - Number(previous !== undefined && isActiveRun(previous));
      return {
        ...current,
        nodes: projectRunOnNodes(current.nodes, previous, projected),
        runs,
        artifacts: mergeArtifacts(current.artifacts, artifacts),
        counts: {
          ...current.counts,
          activeRuns: Math.max(0, current.counts.activeRuns + activeRunDelta),
        },
      };
    });
  }, []);

  const projectProgress = useCallback((progress: RunProgress) => {
    setWorkspace((current) =>
      current === undefined
        ? current
        : { ...current, progress: mergeProgress(current.progress, [progress]) },
    );
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setError(undefined);
    try {
      const snapshot = await getWorkspace(signal);
      setWorkspace((current) => {
        if (current === undefined) return snapshot;
        const runs = mergeRuns(snapshot.runs, current.runs);
        return {
          ...snapshot,
          nodes: current.nodes,
          runs,
          artifacts: mergeArtifacts(snapshot.artifacts, current.artifacts),
          progress: mergeProgress(snapshot.progress, current.progress),
          counts: {
            ...snapshot.counts,
            connectedNodes: current.nodes.length,
            activeRuns: runs.filter(isActiveRun).length,
          },
        };
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(
        cause instanceof Error ? cause.message : "无法连接 OpenBot Server。请确认服务已启动。",
      );
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const workspaceReady = workspace !== undefined;
  useEffect(() => {
    if (!workspaceReady) return;
    return subscribeToWorkspaceEvents({
      onReady(nodes) {
        setWorkspace((current) =>
          current === undefined
            ? current
            : {
                ...current,
                nodes,
                counts: { ...current.counts, connectedNodes: nodes.length },
              },
        );
      },
      onNode(node) {
        setWorkspace((current) => {
          if (current === undefined) return current;
          const nodes = mergeNodes(current.nodes, [node]);
          return {
            ...current,
            nodes,
            counts: { ...current.counts, connectedNodes: nodes.length },
          };
        });
      },
      onNodeRemoved(nodeId) {
        setWorkspace((current) => {
          if (current === undefined) return current;
          const nodes = current.nodes.filter((node) => node.id !== nodeId);
          if (nodes.length === current.nodes.length) return current;
          return {
            ...current,
            nodes,
            counts: { ...current.counts, connectedNodes: nodes.length },
          };
        });
      },
      onState: setWorkspaceRealtimeState,
    });
  }, [workspaceReady]);

  async function handleCreateBot(input: CreateBotInput) {
    const bot = await createBot(input);
    await refresh();
    setDialog(undefined);
    showNotice(`${bot.name} 已创建。`);
  }

  async function handleCreateChannel(input: CreateChannelInput) {
    const channel = await createChannel(input);
    await refresh();
    setSelectedChannelId(channel.id);
    setDialog(undefined);
    setMobilePanel(undefined);
    showNotice(`${channel.name} 已创建。`);
  }

  async function handleJoinBot(botId: string) {
    if (selectedChannelId === undefined) return;
    await joinBotToChannel(selectedChannelId, botId);
    await refresh();
    showNotice("Bot 已加入频道。");
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(undefined), 3000);
  }

  function selectChannel(channelId: string) {
    setSelectedChannelId(channelId);
    setSelectedRunId(undefined);
    setMobilePanel(undefined);
  }

  if (workspace === undefined) {
    return (
      <main className="loading-screen">
        <span className="loading-mark">O</span>
        <h1>{error ? "无法打开 OpenBot" : "正在连接 OpenBot"}</h1>
        <p>{error ?? "正在读取本地频道、Bots 与节点状态…"}</p>
        {error ? (
          <button className="primary-button" type="button" onClick={() => refresh()}>
            重新连接
          </button>
        ) : null}
      </main>
    );
  }

  const selectedChannel = workspace.channels.find((channel) => channel.id === selectedChannelId);
  const selectedRun = workspace.runs.find((run) => run.id === selectedRunId);

  return (
    <div className="app-shell">
      <Sidebar
        bots={workspace.bots}
        channels={workspace.channels}
        runs={workspace.runs}
        ownerName={ownerName}
        selectedChannelId={selectedChannel?.id}
        onOffice={() => setSelectedChannelId(undefined)}
        onSelectChannel={selectChannel}
        onCreateBot={() => setDialog("bot")}
        onCreateChannel={() => setDialog("channel")}
        onLogout={onLogout}
      />

      {selectedChannel ? (
        <ChannelWorkspace
          channel={selectedChannel}
          bots={workspace.bots}
          artifacts={workspace.artifacts}
          progress={workspace.progress}
          onJoin={handleJoinBot}
          onInspectRun={setSelectedRunId}
          onProgress={projectProgress}
          onRun={projectRun}
        />
      ) : (
        <Office
          bots={workspace.bots}
          channels={workspace.channels}
          nodes={workspace.nodes}
          runs={workspace.runs}
          onCreateBot={() => setDialog("bot")}
          onCreateChannel={() => setDialog("channel")}
        />
      )}

      <ContextRail
        realtimeState={workspaceRealtimeState}
        workspace={workspace}
        onInspectRun={setSelectedRunId}
      />

      <MobileNavigation
        panel={mobilePanel}
        bots={workspace.bots}
        channels={workspace.channels}
        nodes={workspace.nodes}
        runs={workspace.runs}
        onPanel={setMobilePanel}
        onOffice={() => {
          setSelectedChannelId(undefined);
          setMobilePanel(undefined);
        }}
        onCreateBot={() => {
          setMobilePanel(undefined);
          setDialog("bot");
        }}
        onCreateChannel={() => {
          setMobilePanel(undefined);
          setDialog("channel");
        }}
        onSelectChannel={selectChannel}
      />

      {selectedRun ? (
        <RunInspector
          artifacts={workspace.artifacts.filter((artifact) => artifact.runId === selectedRun.id)}
          bot={workspace.bots.find((bot) => bot.id === selectedRun.botId)}
          node={workspace.nodes.find((node) => node.id === selectedRun.nodeId)}
          progress={workspace.progress.filter((item) => item.runId === selectedRun.id)}
          run={selectedRun}
          onClose={closeInspector}
        />
      ) : null}

      {dialog === "bot" ? (
        <CreateBotDialog onClose={() => setDialog(undefined)} onCreate={handleCreateBot} />
      ) : null}
      {dialog === "channel" ? (
        <CreateChannelDialog
          bots={workspace.bots}
          onClose={() => setDialog(undefined)}
          onCreate={handleCreateChannel}
        />
      ) : null}
      {notice ? (
        <div className="toast" role="status">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
