import { type FormEvent, useCallback, useEffect, useState } from "react";
import { getModelSettings, type ModelSettingsSummary, saveModelSettings } from "../api";
import { OpenBotMark } from "./OpenBotMark";

export function ModelSettingsScreen({
  onboarding = false,
  onDone,
}: {
  onboarding?: boolean;
  onDone(): void;
}) {
  const [snapshot, setSnapshot] = useState<ModelSettingsSummary>();
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    try {
      const next = await getModelSettings();
      setSnapshot(next);
      if (next.status === "configured") {
        setProvider(next.provider);
        setModel(next.model);
      }
      setError(undefined);
      setApiKey("");
    } catch {
      setError("无法读取模型设置，请检查服务连接后重试。");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !snapshot || snapshot.status === "unavailable") return;
    setBusy(true);
    setError(undefined);
    try {
      const next = await saveModelSettings({
        provider,
        model: model.trim(),
        apiKey,
        revision: snapshot.revision,
      });
      setSnapshot(next);
      setApiKey("");
      onDone();
    } catch (cause) {
      setError(modelError(cause instanceof Error ? cause.message : ""));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-screen model-settings-screen">
      <section className="login-card" aria-labelledby="model-title">
        <OpenBotMark className="onboarding-mark" />
        <h1 id="model-title">{onboarding ? "为 Bot 配置模型" : "模型 API"}</h1>
        <p className="login-copy">选择模型服务，设置 Bot 的默认模型。以后可以在设置中更改。</p>
        {snapshot?.status === "unavailable" ? (
          <p className="connection-warning" role="status">
            这台服务电脑尚未启用模型配置。请更新服务端，或按 GitHub 自部署文档启用。
          </p>
        ) : (
          <form onSubmit={submit}>
            <fieldset className="model-provider-options" disabled={busy || !snapshot}>
              <legend>模型服务</legend>
              {(["openai", "anthropic"] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="model-provider"
                    checked={provider === value}
                    onChange={() => {
                      setProvider(value);
                      setModel("");
                      setApiKey("");
                    }}
                  />
                  {value === "openai" ? "OpenAI" : "Anthropic"}
                </label>
              ))}
            </fieldset>
            <label htmlFor="model-name">模型名称</label>
            <input
              id="model-name"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              maxLength={128}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="填写账户中可用的模型 ID"
              disabled={busy || !snapshot}
              required
            />
            <label htmlFor="model-api-key">
              API Key{snapshot?.status === "configured" ? "（重新输入以更新）" : ""}
            </label>
            <input
              id="model-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              minLength={16}
              maxLength={512}
              placeholder="粘贴 API Key"
              disabled={busy || !snapshot}
              required
            />
            <p className="connection-hint">
              {provider === "openai" ? "api.openai.com" : "api.anthropic.com"} ·
              密钥加密保存在你的服务电脑上。
            </p>
            <button
              type="submit"
              className="primary-button"
              disabled={busy || !snapshot || apiKey.length < 16 || !model.trim()}
            >
              {busy ? "正在验证模型…" : "验证并保存"}
            </button>
          </form>
        )}
        {error ? (
          <>
            <p className="login-error" role="alert">
              {error}
            </p>
            <button
              className="secondary-button"
              type="button"
              disabled={busy}
              onClick={() => void load()}
            >
              重新读取设置
            </button>
          </>
        ) : null}
        <button className="setup-skip" type="button" disabled={busy} onClick={onDone}>
          {onboarding ? "稍后在设置中配置" : "返回设置"}
        </button>
        <p className="login-note">验证只检查模型访问权限，不发送对话或生成内容。</p>
      </section>
    </main>
  );
}
function modelError(code: string): string {
  const messages: Record<string, string> = {
    invalid_credentials: "API Key 无效或没有访问权限，请核对后重试。",
    model_unavailable: "当前账户无法访问这个模型，请检查模型名称。",
    provider_unavailable: "暂时无法验证模型服务，请检查网络后重试。",
    conflict: "设置已在另一处更新。请重新读取后再修改。",
    busy: "另一项模型设置正在保存，请稍后重试。",
    storage_unavailable: "无法安全保存模型配置，原设置未被替换。",
  };
  return messages[code] ?? "模型配置未保存，请检查服务连接后重试。";
}
