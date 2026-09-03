import type {
  Approval,
  ApprovalDecision,
  Artifact,
  AuthSessionSnapshot,
  CreateBotInput,
  CreateChannelInput,
  EmployeeProfile,
  Run,
  RunFrame,
  RunProgress,
  WorkspaceSnapshot,
} from "@openbot/domain";
import { useCallback, useEffect, useState } from "react";
import {
  createBot,
  createChannel,
  decideApproval,
  getAuthSession,
  getEmployeeProfile,
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
import { EmployeeProfileRail } from "./components/EmployeeProfileRail";
import { EmployeeProfileView } from "./components/EmployeeProfileView";
import { ExportEmployeeDialog } from "./components/ExportEmployeeDialog";
import { ImportEmployeeDialog } from "./components/ImportEmployeeDialog";
import { LoginScreen } from "./components/LoginScreen";
import { MobileNavigation, type MobilePanel } from "./components/MobileNavigation";
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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>();
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeProfile>();
  const [employeeProfileLoading, setEmployeeProfileLoading] = useState(false);
  const [employeeProfileError, setEmployeeProfileError] = useState<string>();
  const [employeeExportOpen, setEmployeeExportOpen] = useState(false);
  const [employeeImportOpen, setEmployeeImportOpen] = useState(false);
  const [framesByRun, setFramesByRun] = useState<Map<string, RunFrame>>(() => new Map());
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

  const projectFrame = useCallback((frame: RunFrame) => {
    setFramesByRun((current) => {
      const previous = current.get(frame.runId);
      if (previous !== undefined && previous.revision >= frame.revision) return current;
      const next = new Map(current);
      next.delete(frame.runId);
      next.set(frame.runId, frame);
      if (next.size > 50) {
        const oldest = next.keys().next().value as string | undefined;
        if (oldest !== undefined) next.delete(oldest);
      }
      return next;
    });
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

  const loadEmployeeProfile = useCallback(async (botId: string, signal?: AbortSignal) => {
    setEmployeeProfileLoading(true);
    setEmployeeProfileError(undefined);
    try {
      setEmployeeProfile(await getEmployeeProfile(botId, signal));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setEmployeeProfileError(cause instanceof Error ? cause.message : "无法读取员工档案。");
    } finally {
      if (!signal?.aborted) setEmployeeProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEmployeeId === undefined) {
      setEmployeeProfile(undefined);
      setEmployeeProfileError(undefined);
      setEmployeeProfileLoading(false);
      return;
    }
    const controller = new AbortController();
    setEmployeeProfile(undefined);
    void loadEmployeeProfile(selectedEmployeeId, controller.signal);
    return () => controller.abort();
  }, [loadEmployeeProfile, selectedEmployeeId]);

  const workspaceReady = workspace !== undefined;
  useEffect(() => {
    if (workspace === undefined) return;
    if (workspace.channels.length === 0) {
      if (selectedChannelId !== undefined) setSelectedChannelId(undefined);
      return;
    }
    if (!workspace.channels.some((channel) => channel.id === selectedChannelId)) {
      setSelectedChannelId(workspace.channels[0]?.id);
    }
  }, [selectedChannelId, workspace]);

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
        // Reconcile any events missed while the browser was disconnected.
        void refresh();
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
      onApproval(approval, run) {
        setWorkspace((current) =>
          current === undefined
            ? current
            : {
                ...current,
                approvals: mergeApprovals(current.approvals, [approval]),
                runs: mergeRuns(current.runs, [run]),
              },
        );
      },
      onRun: projectRun,
      onState: setWorkspaceRealtimeState,
    });
  }, [projectRun, refresh, workspaceReady]);

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

  async function handleDecideApproval(approvalId: string, decision: ApprovalDecision) {
    const resolution = await decideApproval(approvalId, decision);
    setWorkspace((current) =>
      current === undefined
        ? current
        : {
            ...current,
            approvals: mergeApprovals(current.approvals, [resolution.approval]),
            runs: mergeRuns(current.runs, [resolution.run]),
          },
    );
    showNotice(decision === "approve" ? "已批准一次。" : "已拒绝该动作。");
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(undefined), 3000);
  }

  function selectChannel(channelId: string) {
    setEmployeeExportOpen(false);
    setEmployeeImportOpen(false);
    setSelectedChannelId(channelId);
    setSelectedEmployeeId(undefined);
    setSelectedRunId(undefined);
    setMobilePanel(undefined);
  }

  function openEmployee(botId: string) {
    setEmployeeExportOpen(false);
    setEmployeeImportOpen(false);
    setSelectedEmployeeId(botId);
    setSelectedRunId(undefined);
    setMobilePanel(undefined);
  }

  function assignEmployee(botId: string) {
    const channel = workspace?.channels.find((item) => item.botIds.includes(botId));
    if (channel === undefined) {
      showNotice("请先把这名员工加入一个频道。");
      return;
    }
    selectChannel(channel.id);
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
        selectedBotId={selectedEmployeeId}
        onSelectChannel={selectChannel}
        onSelectBot={openEmployee}
        onCreateBot={() => setDialog("bot")}
        onCreateChannel={() => setDialog("channel")}
        onLogout={onLogout}
      />

      {selectedEmployeeId ? (
        <EmployeeProfileView
          profile={employeeProfile}
          loading={employeeProfileLoading}
          error={employeeProfileError}
          onRetry={() => void loadEmployeeProfile(selectedEmployeeId)}
          onAssign={() => assignEmployee(selectedEmployeeId)}
          onExport={() => setEmployeeExportOpen(true)}
        />
      ) : selectedChannel ? (
        <ChannelWorkspace
          channel={selectedChannel}
          bots={workspace.bots}
          artifacts={workspace.artifacts}
          progress={workspace.progress}
          onJoin={handleJoinBot}
          onInspectRun={setSelectedRunId}
          onOpenBot={openEmployee}
          onFrame={projectFrame}
          onProgress={projectProgress}
          onRun={projectRun}
        />
      ) : (
        <ChannelEmptyState
          hasBots={workspace.bots.length > 0}
          onCreateBot={() => setDialog("bot")}
          onCreateChannel={() => setDialog("channel")}
        />
      )}

      {selectedEmployeeId ? (
        <EmployeeProfileRail profile={employeeProfile} nodes={workspace.nodes} />
      ) : (
        <ContextRail
          realtimeState={workspaceRealtimeState}
          workspace={workspace}
          onDecideApproval={handleDecideApproval}
          onInspectRun={setSelectedRunId}
        />
      )}

      <MobileNavigation
        panel={mobilePanel}
        bots={workspace.bots}
        channels={workspace.channels}
        runs={workspace.runs}
        approvals={workspace.approvals}
        onPanel={setMobilePanel}
        onDecideApproval={handleDecideApproval}
        onCreateBot={() => {
          setMobilePanel(undefined);
          setDialog("bot");
        }}
        onCreateChannel={() => {
          setMobilePanel(undefined);
          setDialog("channel");
        }}
        onSelectChannel={selectChannel}
        onSelectBot={openEmployee}
      />

      {selectedRun ? (
        <RunInspector
          artifacts={workspace.artifacts.filter((artifact) => artifact.runId === selectedRun.id)}
          bot={workspace.bots.find((bot) => bot.id === selectedRun.botId)}
          node={workspace.nodes.find((node) => node.id === selectedRun.nodeId)}
          progress={workspace.progress.filter((item) => item.runId === selectedRun.id)}
          liveFrame={framesByRun.get(selectedRun.id)}
          run={selectedRun}
          onClose={closeInspector}
        />
      ) : null}

      {dialog === "bot" ? (
        <CreateBotDialog
          onClose={() => setDialog(undefined)}
          onCreate={handleCreateBot}
          onImport={() => {
            setDialog(undefined);
            setEmployeeImportOpen(true);
          }}
        />
      ) : null}
      {dialog === "channel" ? (
        <CreateChannelDialog
          bots={workspace.bots}
          onClose={() => setDialog(undefined)}
          onCreate={handleCreateChannel}
        />
      ) : null}
      {employeeExportOpen && employeeProfile ? (
        <ExportEmployeeDialog
          employee={employeeProfile.employee}
          onClose={() => setEmployeeExportOpen(false)}
          onDownloaded={(fileName) => {
            setEmployeeExportOpen(false);
            showNotice(`已下载安全员工模板：${fileName}`);
          }}
        />
      ) : null}
      {employeeImportOpen ? (
        <ImportEmployeeDialog onClose={() => setEmployeeImportOpen(false)} />
      ) : null}
      {notice ? (
        <div className="toast" role="status">
          {notice}
        </div>
      ) : null}
    </div>
  );
}

function ChannelEmptyState({
  hasBots,
  onCreateBot,
  onCreateChannel,
}: {
  hasBots: boolean;
  onCreateBot(): void;
  onCreateChannel(): void;
}) {
  return (
    <main className="workspace-main channel-first-empty">
      <span className="channel-empty-mark">#</span>
      <p className="empty-eyebrow">OPENBOT CHANNELS</p>
      <h1>从一个长期频道开始</h1>
      <p>频道保存任务、Bot 对话、审批和结果。执行电脑可以随时替换，工作上下文不会丢失。</p>
      <div>
        <button className="primary-button" type="button" onClick={onCreateChannel}>
          创建第一个频道
        </button>
        {!hasBots ? (
          <button className="secondary-button" type="button" onClick={onCreateBot}>
            先创建 Bot
          </button>
        ) : null}
      </div>
    </main>
  );
}

function mergeApprovals(primary: Approval[], secondary: Approval[]): Approval[] {
  const byId = new Map<string, Approval>();
  for (const approval of [...primary, ...secondary]) byId.set(approval.id, approval);
  return Array.from(byId.values())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 100);
}
