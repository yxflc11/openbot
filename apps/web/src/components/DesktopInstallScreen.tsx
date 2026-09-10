import { useCallback, useEffect, useRef, useState } from "react";
import type { NativeServerState, OpenBotDesktopBridge } from "../desktop-runtime";
import { OpenBotMark } from "./OpenBotMark";

const steps = [
  ["checking", "检查安装环境"],
  ["database", "准备本地数据库"],
  ["server", "启动 OpenBot 服务"],
  ["connecting", "完成连接与配置"],
] as const;
export function DesktopInstallScreen({
  bridge,
  onReady,
  onBack,
}: {
  bridge: OpenBotDesktopBridge;
  onReady(serverUrl: string): void;
  onBack(): void;
}) {
  const [state, setState] = useState<NativeServerState>({ status: "idle" });
  const started = useRef(false);
  const active = useRef(true);
  const retained = useRef(false);
  const ready = useRef(onReady);
  ready.current = onReady;
  const install = useCallback(async () => {
    try {
      const existing = await bridge.getNativeServerState?.();
      if (!active.current) return;
      if (existing?.status === "ready") {
        ready.current(existing.serverUrl);
        return;
      }
      retained.current =
        (existing?.status === "idle" && existing.initialized === true) ||
        (existing?.status === "installing" && existing.mode === "resume") ||
        retained.current;
      setState({
        status: "installing",
        step: "checking",
        mode: retained.current ? "resume" : "initialize",
      });
      const result = await bridge.installNativeServer?.();
      if (!active.current) return;
      setState(result ?? { status: "failed", code: "unsupported_platform" });
      if (result?.status === "ready") ready.current(result.serverUrl);
    } catch {
      if (active.current) setState({ status: "failed", code: "installation_failed" });
    }
  }, [bridge]);
  useEffect(() => {
    active.current = true;
    if (!started.current) {
      started.current = true;
      void install();
    }
    const timer = window.setInterval(() => {
      void bridge
        .getNativeServerState?.()
        .then((next) => {
          if (active.current && next.status === "installing") setState(next);
        })
        .catch(() => undefined);
    }, 700);
    return () => {
      active.current = false;
      window.clearInterval(timer);
    };
  }, [bridge, install]);
  const resume = retained.current || (state.status === "installing" && state.mode === "resume");
  const preparing = state.status === "idle";
  const current = state.status === "installing" ? steps.findIndex(([id]) => id === state.step) : -1;
  return (
    <main className="login-screen desktop-install-screen">
      <section className="login-card desktop-install-card" aria-labelledby="install-title">
        <OpenBotMark className="onboarding-mark" />
        <h1 id="install-title">
          {state.status === "failed"
            ? "启动需要处理"
            : resume || preparing
              ? "正在打开 OpenBot"
              : "正在准备你的 OpenBot"}
        </h1>
        <p className="login-copy">
          {resume || preparing ? "正在连接你的工作区…" : "首次使用：准备本地服务与数据库。"}
        </p>
        {!resume && !preparing && (
          <ol className="installation-steps" aria-label="安装进度" aria-live="polite">
            {steps.map(([id, label], index) => (
              <li key={id} aria-current={index === current ? "step" : undefined}>
                <span
                  className={
                    index < current ? "step-done" : index === current ? "step-running" : ""
                  }
                  aria-hidden="true"
                >
                  {index < current ? "✓" : index + 1}
                </span>
                {label}
                <small>{index < current ? "已完成" : index === current ? "进行中" : "等待"}</small>
              </li>
            ))}
          </ol>
        )}
        {state.status === "failed" ? (
          <>
            <p className="login-error" role="alert">
              {state.code === "unsupported_platform"
                ? "此安装包尚不支持本机服务，请使用 Windows 或 macOS 原生安装包，或连接已有服务。"
                : state.code === "credential_unavailable"
                  ? "系统未允许读取已保存的凭据。请解锁系统钥匙串或凭据存储后重试，无需重新输入模型密钥。macOS 弹窗中的密码是系统登录密码；确认是你安装的 OpenBot 后，可选择“始终允许”。"
                  : "未能完成本地服务启动。请检查安装包是否完整、钥匙串是否可用，或重试。OpenBot 不会清空已有数据库。"}
            </p>
            <div className="connection-actions">
              <button className="secondary-button" type="button" onClick={onBack}>
                更改连接方式
              </button>
              <button className="primary-button" type="button" onClick={() => void install()}>
                重试
              </button>
            </div>
          </>
        ) : (
          <p className="login-note" role="status">
            {resume || preparing
              ? "模型设置与已有对话会自动恢复。"
              : "首次准备完成后，日常打开将直接恢复工作区。"}
          </p>
        )}
      </section>
    </main>
  );
}
