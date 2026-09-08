import type { ServerEnv } from "@openbot/config";
import type {
  CreateModelConnectionInput,
  ModelConnection,
  ModelSelection,
  ModelServicesSnapshot,
  Run,
  UpdateModelConnectionInput,
} from "@openbot/domain";
import { modelBaseUrlSchema, modelIdSchema, modelSelectionSchema } from "@openbot/protocol";
import { StoreNotFoundError, StoreValidationError } from "./control-plane-store.js";
import {
  createConfiguredModel,
  createKimiModel,
  createKimiWebExecutor,
  discoverModels,
  type ModelClient,
  ModelRequestError,
} from "./model-client.js";
import { modelProviderPresets } from "./model-provider-presets.js";
import { supportsWebTools, type WebToolExecutor } from "./model-web-tools.js";
import { createTavilyWebExecutor } from "./tavily-web-tools.js";

export interface ModelConnectionStore {
  list(): Promise<ModelConnection[]>;
  get(id: string): Promise<{ connection: ModelConnection; apiKey: string } | undefined>;
  create(
    input: CreateModelConnectionInput & { protocol: ModelConnection["protocol"] },
  ): Promise<ModelConnection>;
  update(id: string, input: UpdateModelConnectionInput): Promise<ModelConnection>;
}

/** Server-owned endpoint selection. Neither model output nor browser input can invent authority. */
export class ModelServices {
  readonly #env: ServerEnv;
  readonly #store: ModelConnectionStore;
  readonly #fetch: typeof fetch;
  readonly #startedAt = new Date().toISOString();
  #operations = 0;

  constructor(env: ServerEnv, store: ModelConnectionStore, fetcher: typeof fetch = fetch) {
    this.#env = env;
    this.#store = store;
    this.#fetch = fetcher;
  }

  async snapshot(): Promise<ModelServicesSnapshot> {
    const connections = await this.#store.list();
    const legacy = this.#legacy();
    return {
      presets: modelProviderPresets,
      connections: legacy === undefined ? connections : [legacy, ...connections],
      customBaseUrls: this.#env.OPENBOT_MODEL_CUSTOM_BASE_URLS,
    };
  }

  async create(input: CreateModelConnectionInput): Promise<ModelConnection> {
    const preset = this.#preset(input.presetId);
    const baseUrl = this.#endpoint(input.presetId, input.baseUrl);
    return this.#store.create({ ...input, baseUrl, protocol: preset.protocol });
  }

  async update(id: string, input: UpdateModelConnectionInput): Promise<ModelConnection> {
    if (id === "legacy-kimi")
      throw new StoreValidationError("环境变量连接请在 Server 配置中修改。");
    return this.#store.update(id, input);
  }

  async validateSelection(selection: ModelSelection): Promise<void> {
    if (!modelSelectionSchema.safeParse(selection).success)
      throw new StoreValidationError("模型连接或模型 ID 无效。");
    await this.#active(selection.connectionId);
  }

  async resolve(run: Run): Promise<ModelClient | undefined> {
    if (run.executionProfile !== "model") throw new ModelRequestError("此员工未启用模型对话。");
    if (run.model === undefined) {
      if (!this.#env.MOONSHOT_API_KEY) return undefined;
      const selected = await this.#active("legacy-kimi");
      return createKimiModel(this.#env, this.#fetch, await this.#webExecutor(selected.connection));
    }
    try {
      if (!modelSelectionSchema.safeParse(run.model).success)
        throw new StoreValidationError("模型连接或模型 ID 无效。");
      const selected = await this.#active(run.model.connectionId);
      return createConfiguredModel(
        {
          ...this.#options(selected, run.model.modelId),
          webExecutor: await this.#webExecutor(selected.connection),
        },
        this.#fetch,
      );
    } catch (error) {
      if (error instanceof StoreValidationError || error instanceof StoreNotFoundError)
        throw new ModelRequestError(error.message);
      throw new ModelRequestError("无法读取模型连接，请检查服务端配置。");
    }
  }

  async discover(id: string, signal: AbortSignal): Promise<string[]> {
    return this.#bounded(async () => {
      const selected = await this.#active(id);
      return discoverModels(this.#options(selected, "unused"), signal, this.#fetch);
    });
  }

  async test(id: string, modelId: string, signal: AbortSignal): Promise<void> {
    if (!modelIdSchema.safeParse(modelId).success) throw new StoreValidationError("模型 ID 无效。");
    await this.#bounded(async () => {
      const selected = await this.#active(id);
      const model = createConfiguredModel(
        { ...this.#options(selected, modelId), webExecutor: null },
        this.#fetch,
      );
      await model.complete(
        {
          name: "Connection test",
          role: "Verify text inference",
          history: [],
          instruction: "Reply with OK.",
        },
        signal,
      );
    });
  }

  async #webExecutor(chat: ModelConnection): Promise<WebToolExecutor | undefined> {
    if (this.#env.TAVILY_API_KEY)
      return createTavilyWebExecutor(this.#env.TAVILY_API_KEY, this.#fetch);
    const explicit = this.#env.OPENBOT_WEB_SEARCH_CONNECTION_ID;
    if (!explicit && supportsWebTools(chat.presetId, chat.baseUrl)) return undefined;
    const id = explicit ?? (this.#env.MOONSHOT_API_KEY ? "legacy-kimi" : undefined);
    if (!id) return undefined;
    const source = await this.#active(id);
    if (!supportsWebTools(source.connection.presetId, source.connection.baseUrl))
      throw new StoreValidationError(
        "共享检索连接必须是已启用的官方 Kimi 连接，或配置 TAVILY_API_KEY。",
      );
    return createKimiWebExecutor(
      this.#options(source, this.#env.OPENBOT_WEB_SEARCH_MODEL),
      this.#fetch,
    );
  }

  #options(selected: { connection: ModelConnection; apiKey: string }, modelId: string) {
    const { connection, apiKey } = selected;
    return {
      presetId: connection.presetId,
      protocol: connection.protocol,
      baseUrl: connection.baseUrl,
      apiKey,
      modelId,
      maxTokens: this.#env.OPENBOT_MODEL_MAX_TOKENS,
      timeoutMs: this.#env.OPENBOT_MODEL_TIMEOUT_MS,
    };
  }

  async #active(id: string): Promise<{ connection: ModelConnection; apiKey: string }> {
    const legacy = id === "legacy-kimi" ? this.#legacy() : undefined;
    const selected =
      legacy === undefined
        ? await this.#store.get(id)
        : {
            connection: legacy,
            apiKey: this.#env.MOONSHOT_API_KEY as string,
          };
    if (selected === undefined)
      throw new StoreNotFoundError("模型连接不存在，请重新选择模型服务。");
    if (!selected.connection.enabled || !selected.connection.hasApiKey)
      throw new StoreValidationError("模型连接已停用，请在模型服务中启用或更换连接。");
    const preset = this.#preset(selected.connection.presetId);
    if (preset.protocol !== selected.connection.protocol)
      throw new StoreValidationError("模型连接协议与预设不匹配。");
    this.#endpoint(selected.connection.presetId, selected.connection.baseUrl);
    return selected;
  }

  #preset(id: string) {
    const preset = modelProviderPresets.find((item) => item.id === id);
    if (preset === undefined) throw new StoreValidationError("未知模型服务预设。");
    return preset;
  }

  #endpoint(presetId: string, value: string): string {
    if (!modelBaseUrlSchema.safeParse(value).success)
      throw new StoreValidationError("API 地址无效。");
    const normalized = value.replace(/\/+$/, "");
    const allowed =
      presetId === "custom"
        ? this.#env.OPENBOT_MODEL_CUSTOM_BASE_URLS
        : this.#preset(presetId).endpoints.map((endpoint) => endpoint.baseUrl.replace(/\/+$/, ""));
    if (!allowed.includes(normalized))
      throw new StoreValidationError(
        "此 API 地址未获授权。请选择预设地址，或在 Server 中配置自定义地址。",
      );
    return normalized;
  }

  #legacy(): ModelConnection | undefined {
    if (this.#env.MOONSHOT_API_KEY === undefined) return undefined;
    return {
      id: "legacy-kimi",
      name: "服务端默认 Kimi",
      presetId: "kimi",
      protocol: "openai-chat",
      baseUrl: this.#env.MOONSHOT_BASE_URL,
      enabled: true,
      hasApiKey: true,
      revision: 1,
      source: "environment",
      defaultModel: this.#env.MOONSHOT_MODEL,
      createdAt: this.#startedAt,
      updatedAt: this.#startedAt,
    };
  }

  async #bounded<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#operations >= 2) throw new StoreValidationError("模型连接检查正在进行，请稍后重试。");
    this.#operations++;
    try {
      return await operation();
    } finally {
      this.#operations--;
    }
  }
}
