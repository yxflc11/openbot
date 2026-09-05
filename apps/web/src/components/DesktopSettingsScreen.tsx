import type { DesktopSetupPlanInput } from "../desktop-runtime";
import { OpenBotMark } from "./OpenBotMark";
export function DesktopSettingsScreen({
  error,
  plan,
  onModel,
  onConnection,
  onRole,
  onWorker,
  onBack,
}: {
  error?: string | undefined;
  plan: DesktopSetupPlanInput;
  onModel(): void;
  onConnection(): void;
  onRole(): void;
  onWorker(): void;
  onBack(): void;
}) {
  return (
    <main className="login-screen">
      <section className="login-card desktop-settings-card" aria-labelledby="settings-title">
        <OpenBotMark className="onboarding-mark" />
        <h1 id="settings-title">设置</h1>
        <p className="login-copy">
          {plan.mode === "host"
            ? "服务仅供本机使用，退出 OpenBot 后停止。"
            : "这台电脑连接远程 OpenBot 服务。"}
        </p>
        {error ? (
          <p className="login-error" role="alert">
            {error}
          </p>
        ) : null}
        <nav className="settings-rows" aria-label="Desktop 设置">
          <button type="button" onClick={onModel}>
            <span>
              模型 API<small>OpenAI / Anthropic</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
          {plan.mode !== "host" ? (
            <button type="button" onClick={onConnection}>
              <span>
                服务电脑<small>更改连接地址</small>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          ) : null}
          <button type="button" onClick={onWorker}>
            <span>
              工作电脑<small>查看设备、绑定与权限</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
          <button type="button" onClick={onRole}>
            <span>
              这台电脑的用途<small>服务电脑或本地客户端</small>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        </nav>
        <button className="setup-skip" type="button" onClick={onBack}>
          返回 OpenBot
        </button>
      </section>
    </main>
  );
}
