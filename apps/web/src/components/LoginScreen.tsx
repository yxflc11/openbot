import { type FormEvent, useState } from "react";
import { ApiError } from "../api";

export function LoginScreen({
  ownerName,
  onLogin,
}: {
  ownerName?: string;
  onLogin(password: string): Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || password.length === 0) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await onLogin(password);
    } catch (cause) {
      setError(loginErrorMessage(cause));
      setSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-robot" aria-hidden="true">
          <img src="/robots/pixel-bot.svg" alt="" />
        </div>
        <p className="login-eyebrow">SELF-HOSTED WORKSPACE</p>
        <h1 id="login-title">进入 OpenBot</h1>
        <p className="login-copy">
          {ownerName ? `${ownerName}，` : ""}使用部署时设置的 Owner 密码继续。
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="owner-password">Owner 密码</label>
          <input
            id="owner-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="输入本地密码"
          />
          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="primary-button" type="submit" disabled={submitting || !password}>
            {submitting ? "正在验证…" : "登录"}
          </button>
        </form>
        <p className="login-note">凭证只发送给你自己的 OpenBot Server。</p>
      </section>
    </main>
  );
}

function loginErrorMessage(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 401) return "密码不正确，请重试。";
  if (cause instanceof ApiError && cause.status === 429) return "尝试次数过多，请稍后再试。";
  return cause instanceof Error ? cause.message : "暂时无法登录 OpenBot。";
}
