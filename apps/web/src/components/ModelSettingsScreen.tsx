import {
  type ModelProviderId,
  modelProviderBaseUrl,
  modelProviderPreset,
  modelProviderPresets,
} from "@openbot/domain";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  discoverModelSettings,
  getModelSettings,
  type ModelSettingsSummary,
  saveModelSettings,
} from "../api";
import { OpenBotMark } from "./OpenBotMark";

export function ModelSettingsScreen({
  onboarding = false,
  embedded = false,
  onDone,
}: {
  onboarding?: boolean;
  embedded?: boolean;
  onDone(): void;
}) {
  const [snapshot, setSnapshot] = useState<ModelSettingsSummary>();
  const [provider, setProvider] = useState<ModelProviderId>("openai");
  const [baseUrl, setBaseUrl] = useState(modelProviderBaseUrl("openai"));
  const [models, setModels] = useState<string[]>();
  const discovery = useRef<AbortController | null>(null);
  useEffect(() => () => discovery.current?.abort(), []);
  const preset = modelProviderPreset(provider);
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    try {
      const next = await getModelSettings();
      setSnapshot(next);
      if (next.status === "configured") {
        setProvider(next.provider);
        setBaseUrl(modelProviderBaseUrl(next.provider, next.baseUrl));
        setModels(undefined);
        setModel(next.model);
        setAgentEnabled(next.agentEnabled ?? false);
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
    setSaved(false);
    setError(undefined);
    try {
      const next = await saveModelSettings({
        provider,
        baseUrl,
        agentEnabled,
        model: model.trim(),
        apiKey,
        revision: snapshot.revision,
      });
      setSnapshot(next);
      setApiKey("");
      setSaved(true);
      if (!embedded) onDone();
    } catch (cause) {
      setError(modelError(cause instanceof Error ? cause.message : ""));
    } finally {
      setBusy(false);
    }
  }
  const Container = embedded ? "div" : "main";
  return (
    <Container
      className={embedded ? "model-settings-embedded" : "login-screen model-settings-screen"}
    >
      <section
        className="login-card"
        aria-label={embedded ? "模型 API 配置" : undefined}
        aria-labelledby={embedded ? undefined : "model-title"}
      >
        {!embedded && <OpenBotMark className="onboarding-mark" />}
        {!embedded && <h1 id="model-title">{onboarding ? "为 Bot 配置模型" : "模型 API"}</h1>}
        <p className="login-copy">选择模型服务，设置 Bot 的默认模型。以后可以在设置中更改。</p>
        {snapshot?.status === "unavailable" ? (
          <p className="connection-warning" role="status">
            这台服务电脑尚未启用模型配置。请更新服务端，或按 GitHub 自部署文档启用。
          </p>
        ) : (
          <form onSubmit={submit}>
            <fieldset className="model-provider-options" disabled={busy || !snapshot}>
              <legend>模型服务</legend>
              {modelProviderPresets.map((item) => (
                <label key={item.id} className="model-provider-card">
                  <input
                    type="radio"
                    name="model-provider"
                    checked={provider === item.id}
                    onChange={() => {
                      setProvider(item.id);
                      setBaseUrl(modelProviderBaseUrl(item.id));
                      setModel(
                        item.id === "moonshot" ? "kimi-k3" : (item.suggestedModels[0] ?? ""),
                      );
                      setModels(undefined);
                      setSaved(false);
                      setError(undefined);
                      setApiKey("");
                    }}
                  />
                  {providerLabel(item.id)}
                </label>
              ))}
            </fieldset>
            <div className="model-config-group">
              <div className="model-config-row">
                <label htmlFor="model-region">API 地址与区域</label>
                <div className="model-config-control">
                  <select
                    id="model-region"
                    value={baseUrl}
                    disabled={busy || !snapshot}
                    onChange={(event) => {
                      setBaseUrl(event.target.value);
                      setApiKey("");
                      setModels(undefined);
                      setSaved(false);
                      setError(undefined);
                    }}
                  >
                    {preset.endpoints.map((endpoint) => (
                      <option key={endpoint.baseUrl} value={endpoint.baseUrl}>
                        {regionLabel(endpoint.name)}
                      </option>
                    ))}
                  </select>
                  <p className="connection-hint">{baseUrl}</p>
                </div>
              </div>
              <div className="model-config-row">
                <label htmlFor="model-name">模型名称</label>
                <div className="model-config-control">
                  <input
                    id="model-name"
                    list="model-suggestions"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    maxLength={128}
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder={
                      provider === "openrouter"
                        ? "填写 author/model 格式的模型 ID"
                        : "填写账户中可用的模型 ID"
                    }
                    disabled={busy || !snapshot}
                    required
                  />
                  <datalist id="model-suggestions">
                    {(models ?? preset.suggestedModels).map((id) => (
                      <option key={id} value={id} />
                    ))}
                  </datalist>
                  <p className="connection-hint">
                    可选择常用模型或手填模型 ID，实际可用性以你的账户为准。
                    {provider === "ark" ? "火山方舟支持填写已开通的推理接入点 ID。" : ""}
                  </p>
                </div>
              </div>
              <div className="model-config-row">
                <label htmlFor="model-api-key">
                  API Key{snapshot?.status === "configured" ? "（重新输入以更新）" : ""}
                </label>
                <div className="model-config-control">
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
                    密钥加密保存在你的服务电脑上，切换厂商或区域后需要重新输入。
                  </p>
                </div>
              </div>
            </div>
            {preset.discovery ? (
              <button
                className="secondary-button"
                type="button"
                disabled={busy || !snapshot || apiKey.length < 16}
                onClick={async () => {
                  setBusy(true);
                  setError(undefined);
                  setSaved(false);
                  const controller = new AbortController();
                  discovery.current = controller;
                  try {
                    const result = await discoverModelSettings(
                      { provider, baseUrl, apiKey },
                      controller.signal,
                    );
                    setModels(result.models);
                  } catch (cause) {
                    if (!controller.signal.aborted)
                      setError(modelError(cause instanceof Error ? cause.message : ""));
                  } finally {
                    if (!controller.signal.aborted) setBusy(false);
                  }
                }}
              >
                获取模型列表
              </button>
            ) : (
              <p className="connection-hint">
                此服务暂不支持模型列表验证。保存只检查配置格式，密钥与模型是否可调用将在任务运行时确认。
              </p>
            )}
            {models ? (
              <p className="connection-hint" role="status">
                已读取 {models.length} 个模型，可在模型名称中选择。
              </p>
            ) : null}
            {provider === "openrouter" ? (
              <p className="connection-hint">
                OpenRouter
                会将任务交给其模型提供商。请选择支持工具调用的具体模型；验证只检查密钥和模型元数据，不生成付费回复。当前关闭自动回退，并要求路由满足工具参数和数据收集限制。
              </p>
            ) : null}
            <div className="model-agent-group">
              <label className="model-agent-option">
                <span>启用原生 Agent</span>
                <span className="model-agent-toggle">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-checked={agentEnabled}
                    aria-label="启用原生 Agent"
                    checked={agentEnabled}
                    onChange={(event) => setAgentEnabled(event.target.checked)}
                    disabled={busy || !snapshot}
                  />
                  <span aria-hidden="true" />
                </span>
              </label>
              <p className="connection-hint">
                启用后，新建的无电脑任务会将任务内容和按需读取的当前频道上下文发送给所选模型， 由
                Bot 读取有界资料、准备报告或待审经验并回复，可能产生 API 费用。
              </p>
            </div>
            <button
              type="submit"
              className="primary-button model-save-button"
              disabled={busy || !snapshot || apiKey.length < 16 || !model.trim()}
            >
              {busy ? "正在处理…" : preset.discovery ? "验证并保存" : "保存配置"}
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
        {saved && (
          <p className="settings-success" role="status">
            {snapshot?.status === "configured" && snapshot.verification === "not_checked"
              ? "模型配置已保存，尚未在线验证。"
              : "模型配置已验证并保存。"}
          </p>
        )}
        {!embedded && (
          <button className="setup-skip" type="button" disabled={busy} onClick={onDone}>
            {onboarding ? "稍后在设置中配置" : "返回设置"}
          </button>
        )}
        <p className="login-note">获取列表与保存不会发送对话或生成内容。</p>
      </section>
    </Container>
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

function providerLabel(id: ModelProviderId): string {
  const labels: Record<ModelProviderId, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    gemini: "Google Gemini",
    deepseek: "DeepSeek",
    moonshot: "Kimi（月之暗面）",
    openrouter: "OpenRouter",
    siliconflow: "硅基流动",
    dashscope: "阿里云百炼",
    zai: "智谱 / Z.AI",
    minimax: "MiniMax",
    ark: "火山方舟",
  };
  return labels[id];
}
function regionLabel(name: string): string {
  return (
    (
      {
        China: "中国站",
        Global: "国际站",
        International: "国际站 / 新加坡",
        US: "美国",
        Beijing: "北京",
        "Standard API": "标准 API",
      } as Record<string, string>
    )[name] ?? name
  );
}
