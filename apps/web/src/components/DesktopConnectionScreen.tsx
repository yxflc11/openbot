import { type FormEvent, useState } from "react";
import type { ConfigureDesktopServerResult, DesktopConnectionState } from "../desktop-runtime";

export function DesktopConnectionScreen({
  canCancel = false,
  connection,
  onCancel,
  onConfigure,
}: {
  canCancel?: boolean;
  connection: DesktopConnectionState;
  onCancel?(): void;
  onConfigure(serverUrl: string): Promise<ConfigureDesktopServerResult>;
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
        <p className="login-copy">
          输入自部署 OpenBot Server 的公开地址；Desktop 会先验证服务，再由系统窗口请你确认。
        </p>
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
