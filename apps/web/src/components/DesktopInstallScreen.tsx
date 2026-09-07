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
  const ready = useRef(onReady);
  ready.current = onReady;
  const install = useCallback(async () => {
    setState({ status: "installing", step: "checking" });
    try {
      const result = await bridge.installNativeServer?.();
      setState(result ?? { status: "failed", code: "unsupported_platform" });
      if (result?.status === "ready") ready.current(result.serverUrl);
    } catch {
      setState({ status: "failed", code: "installation_failed" });
    }
  }, [bridge]);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void install();
    }
    let active = true;
    const timer = window.setInterval(() => {
      void bridge
        .getNativeServerState?.()
        .then((next) => {
          if (active && next.status === "installing") setState(next);
        })
        .catch(() => undefined);
    }, 700);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [bridge, install]);
  const current = state.status === "installing" ? steps.findIndex(([id]) => id === state.step) : -1;
  return (
    <main className="login-screen desktop-install-screen">
      <section className="login-card desktop-install-card" aria-labelledby="install-title">
        <OpenBotMark className="onboarding-mark" />
        <h1 id="install-title">
          {state.status === "failed" ? "安装需要处理" : "正在准备你的 OpenBot"}
        </h1>
        <p className="login-copy">本地服务和数据库会自动配置。已有数据会保留。</p>
        <ol className="installation-steps" aria-label="安装进度" aria-live="polite">
          {steps.map(([id, label], index) => (
            <li key={id} aria-current={index === current ? "step" : undefined}>
              <span
                className={index < current ? "step-done" : index === current ? "step-running" : ""}
                aria-hidden="true"
              >
                {index < current ? "✓" : index + 1}
              </span>
              {label}
              <small>{index < current ? "已完成" : index === current ? "进行中" : "等待"}</small>
            </li>
          ))}
        </ol>
        {state.status === "failed" ? (
          <>
            <p className="login-error" role="alert">
              {state.code === "unsupported_platform"
                ? "此安装包尚不支持本机服务，请使用 macOS 原生安装包，或连接已有的服务电脑。"
                : "未能完成本地服务启动。请检查安装包是否完整、钥匙串是否可用，或重试。OpenBot 不会清空已有数据库。"}
            </p>
            <div className="connection-actions">
              <button className="secondary-button" type="button" onClick={onBack}>
                返回安装选择
              </button>
              <button className="primary-button" type="button" onClick={() => void install()}>
                重试
              </button>
            </div>
          </>
        ) : (
          <p className="login-note" role="status">
            首次启动可能需要一点时间…
          </p>
        )}
      </section>
    </main>
  );
}
