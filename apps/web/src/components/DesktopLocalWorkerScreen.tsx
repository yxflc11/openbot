import { type FormEvent, useState } from "react";
import type {
  DesktopLocalWorkerOperationResult,
  DesktopLocalWorkerState,
} from "../desktop-runtime";

export function DesktopLocalWorkerScreen({
  onContinue,
  onEnable,
  onOpenSettings,
  onRefresh,
  onSetup,
  state,
}: {
  onContinue(): void;
  onEnable(): Promise<DesktopLocalWorkerOperationResult>;
  onOpenSettings(): Promise<DesktopLocalWorkerOperationResult>;
  onRefresh(): Promise<DesktopLocalWorkerState>;
  onSetup(nodeId: string): Promise<DesktopLocalWorkerOperationResult>;
  state: DesktopLocalWorkerState;
}) {
  const [nodeId, setNodeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function run(operation: () => Promise<DesktopLocalWorkerOperationResult>) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await operation();
      if (result.status === "failed") setError(localWorkerErrorMessage(result.code));
    } catch {
      setError("Desktop 暂时无法完成本机 Worker 配置，请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nodeId.trim()) return;
    await run(() => onSetup(nodeId.trim()));
  }

  return (
    <main className="login-screen desktop-worker-screen">
      <section className="login-card desktop-worker-card" aria-labelledby="desktop-worker-title">
        <div className="connection-mark" aria-hidden="true">
          O
        </div>
        <p className="login-eyebrow">OPENBOT WORKER</p>
        <h1 id="desktop-worker-title">配置这台工作电脑</h1>
        <p className="login-copy">Desktop 仍然可以正常使用；这里只为这台电脑增加任务执行能力。</p>

        <WorkerStateSummary state={state} />

        {state.status === "not-configured" ? (
          <form onSubmit={submit}>
            <label htmlFor="desktop-worker-node-id">电脑名称</label>
            <input
              id="desktop-worker-node-id"
              autoCapitalize="none"
              autoComplete="off"
              maxLength={128}
              pattern="[A-Za-z0-9][A-Za-z0-9._:-]*"
              placeholder="例如 mac-studio-1"
              spellCheck={false}
              value={nodeId}
              onChange={(event) => setNodeId(event.target.value)}
            />
            <p className="connection-hint">
              Server 会签发一次性绑定凭证；凭证不会进入页面、文件、命令参数或日志。
            </p>
            <button className="primary-button" disabled={busy || !nodeId.trim()} type="submit">
              {busy ? "正在配置…" : "配置并启用 Worker"}
            </button>
          </form>
        ) : null}

        {state.status === "disabled" ? (
          <button
            className="primary-button"
            disabled={busy}
            type="button"
            onClick={() => run(onEnable)}
          >
            {busy ? "正在启用…" : "启用本机 Worker"}
          </button>
        ) : null}

        {state.status === "requires-approval" ? (
          <div className="desktop-worker-actions">
            <button
              className="primary-button"
              disabled={busy}
              type="button"
              onClick={() => run(onOpenSettings)}
            >
              打开“登录项”设置
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              type="button"
              onClick={() => run(async () => ({ status: "succeeded", state: await onRefresh() }))}
            >
              刷新状态
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="login-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="desktop-worker-footer">
          <button className="secondary-button" disabled={busy} type="button" onClick={onContinue}>
            稍后配置，先进入 OpenBot
          </button>
          <span>稍后可以从设备管理再次完成这一步。</span>
        </div>
      </section>
    </main>
  );
}

function WorkerStateSummary({ state }: { state: DesktopLocalWorkerState }) {
  const content = {
    disabled: ["已绑定，尚未启用", "本机身份有效；启用后台项目后才能接收任务。"],
    enabled: ["Worker 已启用", "这台电脑已经可以作为 OpenBot 工作电脑。"],
    invalid: ["本机 Worker 状态无效", "组件、配置或系统凭证未通过校验；不会自动放宽安全检查。"],
    "not-configured": ["等待配置", "为这台电脑命名后，Desktop 将通过已登录的 Server 完成绑定。"],
    "not-selected": ["当前计划未选择 Worker", "你可以返回安装计划后重新选择。"],
    "requires-approval": [
      "等待 macOS 批准",
      "绑定已完成，但必须在“系统设置 > 通用 > 登录项与扩展”允许后台运行。",
    ],
    unavailable: [
      "当前安装包不可配置 Worker",
      "本平台适配器或经过授权的 companion 未包含在此包中；Desktop 客户端仍可使用。",
    ],
  }[state.status];
  return (
    <section className={`desktop-worker-status is-${state.status}`} aria-live="polite">
      <strong>{content[0]}</strong>
      <p>{content[1]}</p>
    </section>
  );
}

export function localWorkerErrorMessage(
  code: Extract<DesktopLocalWorkerOperationResult, { status: "failed" }>["code"],
): string {
  switch (code) {
    case "invalid_node_id":
      return "电脑名称只能使用字母、数字、点、下划线、冒号和连字符。";
    case "not_selected":
      return "当前安装计划没有选择本机 Worker。";
    case "unavailable":
      return "当前平台或安装包没有可用的本机 Worker 组件。";
    case "authentication_required":
      return "登录会话已失效，请重新登录后再配置。";
    case "server_unavailable":
      return "Server 暂时无法签发一次性绑定凭证。";
    case "already_configured":
      return "本机已经存在 Worker 身份；请刷新后启用，避免静默覆盖。";
    case "busy":
      return "另一项本机 Worker 操作仍在进行。";
    case "native_failed":
      return "原生组件未通过校验或系统操作失败，未授予新的执行权限。";
  }
}
