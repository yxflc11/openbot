import { type FormEvent, useState } from "react";
import { desktopSetupModeTitle } from "../desktop-setup";
import type {
  ConfigureDesktopServerResult,
  DesktopConnectionState,
  DesktopSetupPlanInput,
} from "../desktop-runtime";

export function DesktopConnectionScreen({
  canCancel = false,
  connection,
  onCancel,
  onChangePlan,
  onConfigure,
  setupPlan,
}: {
  canCancel?: boolean;
  connection: DesktopConnectionState;
  onCancel?(): void;
  onChangePlan?(): void;
  onConfigure(serverUrl: string): Promise<ConfigureDesktopServerResult>;
  setupPlan?: DesktopSetupPlanInput | undefined;
}) {
  const [serverUrl, setServerUrl] = useState(
    connection.status === "configured" ? connection.serverUrl : "",
  );
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || serverUrl.trim().length === 0) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await onConfigure(serverUrl);
      if (result.status === "failed") setError(desktopConnectionErrorMessage(result.code));
      if (result.status !== "configured") setSubmitting(false);
    } catch {
      setError("Desktop 暂时无法完成连接，请重试。");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen desktop-connection-screen">
      <section className="login-card desktop-connection-card" aria-labelledby="connection-title">
        <div className="connection-mark" aria-hidden="true">
          O
        </div>
        <p className="login-eyebrow">OPENBOT DESKTOP</p>
        <h1 id="connection-title">连接你的 Server</h1>
        <p className="login-copy">{desktopConnectionCopy(setupPlan)}</p>
        {setupPlan ? (
          <section className="connection-plan-summary" aria-label="当前安装计划">
            <span>
              <strong>{desktopSetupModeTitle(setupPlan.mode)}</strong>
              <small>
                {setupPlan.plannedWorkerCount === 0
                  ? "暂不配置工作电脑"
                  : `计划 ${setupPlan.plannedWorkerCount} 台工作电脑`}
              </small>
            </span>
            {onChangePlan ? (
              <button className="secondary-button" type="button" onClick={onChangePlan}>
                修改计划
              </button>
            ) : null}
          </section>
        ) : null}
        {connection.status === "invalid" ? (
          <p className="connection-warning" role="alert">
            已保存的连接配置无效，请重新选择 Server。
          </p>
        ) : null}
        <form onSubmit={handleSubmit}>
          <label htmlFor="desktop-server-url">Server 地址</label>
          <input
            id="desktop-server-url"
            type="url"
            autoCapitalize="none"
            autoComplete="url"
            spellCheck={false}
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
            placeholder="https://openbot.example.com"
          />
          <p className="connection-hint">远程地址必须使用 HTTPS；本机可使用 localhost HTTP。</p>
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="connection-actions">
            {canCancel ? (
              <button
                className="secondary-button"
                type="button"
                onClick={onCancel}
                disabled={submitting}
              >
                返回
              </button>
            ) : null}
            <button
              className="primary-button"
              type="submit"
              disabled={submitting || !serverUrl.trim()}
            >
              {submitting ? "正在检查…" : "检查并连接"}
            </button>
          </div>
        </form>
        <p className="login-note">这里只保存 Server 地址；登录凭证保留在独立的 Desktop 会话中。</p>
      </section>
    </main>
  );
}

function desktopConnectionCopy(plan?: DesktopSetupPlanInput): string {
  if (plan?.mode === "host") {
    return "自动安装 Server 与 PostgreSQL 的功能尚未交付；如果你已经手动部署，可以先验证并连接它。";
  }
  if (plan?.mode === "advanced") {
    return "完成独立 Server 部署后在这里连接；你也可以完全不安装 Desktop，直接使用 Web。";
  }
  if (plan?.mode === "client-worker") {
    return "先连接唯一的 OpenBot Server；之后再逐台安装 Worker Service 并完成绑定。";
  }
  return "输入自部署 OpenBot Server 的公开地址；Desktop 会先验证服务，再由系统窗口请你确认。";
}

export function desktopConnectionErrorMessage(
  code: Extract<ConfigureDesktopServerResult, { status: "failed" }>["code"],
): string {
  switch (code) {
    case "invalid_url":
      return "地址无效：远程 Server 使用 HTTPS，本机可使用 localhost HTTP。";
    case "server_unreachable":
      return "无法连接该地址，请检查 Server、网络和证书。";
    case "server_redirected":
      return "该地址发生了重定向，请填写最终的 Server 地址。";
    case "not_openbot_server":
      return "该地址没有返回可识别的 OpenBot Server。";
    case "confirmation_unavailable":
      return "系统确认窗口不可用，请重试。";
    case "storage_unavailable":
      return "无法安全保存连接配置，请检查应用数据目录后重试。";
  }
}
