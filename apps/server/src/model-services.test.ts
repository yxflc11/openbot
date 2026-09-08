import { serverEnvSchema } from "@openbot/config";
import type { ModelConnection, Run } from "@openbot/domain";
import { describe, expect, it, vi } from "vitest";
import { type ModelConnectionStore, ModelServices } from "./model-services.js";

const apiKey = "private-test-model-key";
const run = (model?: Run["model"]): Run => ({
  id: "run",
  channelId: "channel",
  botId: "employee",
  executionProfile: "model",
  title: "Test",
  instruction: "Hello",
  status: "running",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...(model === undefined ? {} : { model }),
});

function fixture(settings: Record<string, unknown> = {}) {
  const env = serverEnvSchema.parse({ OPENBOT_OWNER_PASSWORD: "test-owner-password", ...settings });
  const secrets = new Map<string, { connection: ModelConnection; apiKey: string }>();
  const store: ModelConnectionStore = {
    async list() {
      return [...secrets.values()].map(({ connection }) => connection);
    },
    async get(id) {
      return secrets.get(id);
    },
    async create(input) {
      const connection: ModelConnection = {
        id: `connection-${secrets.size}`,
        name: input.name,
        presetId: input.presetId,
        baseUrl: input.baseUrl,
        protocol: input.protocol,
        source: "saved",
        hasApiKey: true,
        enabled: true,
        revision: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      secrets.set(connection.id, { connection, apiKey: input.apiKey });
      return connection;
    },
    async update(id, input) {
      const row = secrets.get(id);
      if (!row) throw new Error("Missing fixture.");
      if (input.enabled !== undefined) row.connection.enabled = input.enabled;
      if (input.apiKey !== undefined) row.apiKey = input.apiKey;
      if (input.name !== undefined) row.connection.name = input.name;
      return row.connection;
    },
  };
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({
      choices: [{ finish_reason: "stop", message: { content: "OK" } }],
    }),
  );
  const service = new ModelServices(env, store, fetcher);
  const create = (presetId = "deepseek", baseUrl = "https://api.deepseek.com") =>
    service.create({ name: "Configured service", presetId, baseUrl, apiKey });
  return { service, store, secrets, fetcher, create };
}

describe("Owner model services", () => {
  it("creates presets without inference and exposes only public connection metadata", async () => {
    const f = fixture();
    const connection = await f.create();
    const snapshot = await f.service.snapshot();
    expect(snapshot.connections).toEqual([connection]);
    expect(snapshot.presets.map((preset) => preset.id)).toEqual(
      expect.arrayContaining([
        "openai",
        "anthropic",
        "gemini",
        "deepseek",
        "kimi",
        "openrouter",
        "siliconflow",
        "dashscope",
        "zai",
        "minimax",
        "ark",
        "custom",
      ]),
    );
    expect(JSON.stringify(snapshot)).not.toContain(apiKey);
    expect(snapshot.connections[0]).not.toHaveProperty("apiKey");
    expect(f.fetcher).not.toHaveBeenCalled();
  });

  it("allows only preset endpoints and exact operator-authorized custom endpoints", async () => {
    const f = fixture({ OPENBOT_MODEL_CUSTOM_BASE_URLS: "https://gateway.example/v1" });
    for (const url of [
      "https://other.example/v1",
      "http://api.deepseek.com",
      "https://api.deepseek.com.evil.example",
      "https://key@api.deepseek.com",
      "https://api.deepseek.com?api_key=key",
      "https://api.deepseek.com/#key",
      "https://api.deepseek.com/../private",
    ])
      await expect(f.create("deepseek", url)).rejects.toThrow();
    await expect(f.create("unknown-provider")).rejects.toThrow();
    await expect(f.create("custom", "https://unauthorized.example/v1")).rejects.toThrow();
    const custom = await f.create("custom", "https://gateway.example/v1/");
    expect(custom.baseUrl).toBe("https://gateway.example/v1");
    expect(f.fetcher).not.toHaveBeenCalled();
  });

  it("routes by each Run selection, preserves slash IDs, and never falls back for missing or disabled bindings", async () => {
    const f = fixture({ MOONSHOT_API_KEY: "legacy-key" });
    const a = await f.create();
    const b = await f.create("openrouter", "https://openrouter.ai/api/v1");
    for (const [connection, modelId] of [
      [a, "deepseek-v4-flash"],
      [b, "vendor/model:version"],
    ] as const) {
      const client = await f.service.resolve(run({ connectionId: connection.id, modelId }));
      await client?.complete(
        { name: "Test", role: "Assistant", instruction: "Hello", history: [] },
        new AbortController().signal,
      );
      const request = f.fetcher.mock.calls.at(-1);
      expect(String(request?.[0])).toContain(connection.baseUrl);
      expect(JSON.parse(String(request?.[1]?.body)).model).toBe(modelId);
    }
    await f.service.update(a.id, { expectedRevision: 1, enabled: false });
    await expect(
      f.service.resolve(run({ connectionId: a.id, modelId: "deepseek-v4-flash" })),
    ).rejects.toThrow("停用");
    await expect(
      f.service.resolve(run({ connectionId: "missing", modelId: "model" })),
    ).rejects.toThrow("不存在");
    expect(f.fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps legacy Kimi configured without copying or exposing its environment key", async () => {
    const f = fixture({ MOONSHOT_API_KEY: "legacy-secret-key" });
    const snapshot = await f.service.snapshot();
    expect(snapshot.connections).toMatchObject([
      { id: "legacy-kimi", source: "environment", defaultModel: "kimi-k3" },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("legacy-secret-key");
    expect(await f.store.list()).toEqual([]);
    expect(await f.service.resolve(run())).toBeDefined();
    await expect(
      f.service.update("legacy-kimi", { expectedRevision: 1, enabled: false }),
    ).rejects.toThrow();
    expect(await fixture().service.resolve(run())).toBeUndefined();
  });

  it("revalidates stored protocol/endpoint authority before using credentials", async () => {
    const f = fixture();
    const connection = await f.create();
    connection.baseUrl = "https://untrusted.example";
    await expect(
      f.service.resolve(run({ connectionId: connection.id, modelId: "model" })),
    ).rejects.toThrow("授权");
    expect(f.fetcher).not.toHaveBeenCalled();
  });
});

describe("shared retrieval routing", () => {
  const input = {
    name: "Test",
    role: "Research",
    instruction: "Search public sources",
    history: [{ instruction: "private conversation sentinel", reply: "private reply sentinel" }],
  };
  const tool = {
    id: "call",
    type: "function",
    function: { name: "web_search", arguments: '{"query":"public search query"}' },
  };
  const response = (message: unknown, finish_reason = "stop") =>
    Response.json({ choices: [{ message, finish_reason }] });
  it("uses Tavily independently of the selected inference credentials", async () => {
    const f = fixture({ TAVILY_API_KEY: "search-key", MOONSHOT_API_KEY: "legacy-key" });
    const connection = await f.create();
    let turns = 0;
    f.fetcher.mockImplementation(async (url, init) => {
      const auth = new Headers(init?.headers).get("authorization");
      if (String(url).startsWith("https://api.tavily.com/")) {
        expect(auth).toBe("Bearer search-key");
        expect(String(init?.body)).not.toContain("private conversation sentinel");
        return Response.json({
          results: [{ url: "https://example.com", title: "Source", content: "Evidence" }],
        });
      }
      expect(String(url)).toContain("api.deepseek.com");
      expect(auth).toBe(`Bearer ${apiKey}`);
      expect(String(init?.body)).not.toContain("search-key");
      return turns++ === 0
        ? response({ role: "assistant", content: null, tool_calls: [tool] }, "tool_calls")
        : response({ role: "assistant", content: "Source-backed answer" });
    });
    const model = await f.service.resolve(
      run({ connectionId: connection.id, modelId: "chosen-deepseek" }),
    );
    expect(await model?.complete(input, new AbortController().signal)).toBe("Source-backed answer");
    expect(f.fetcher).toHaveBeenCalledTimes(3);
  });
  it("shares configured Kimi retrieval without replacing another provider or sharing chat history", async () => {
    const f = fixture({ MOONSHOT_API_KEY: "legacy-retrieval-key" });
    const connection = await f.create();
    let chatTurns = 0,
      bridgeTurns = 0;
    f.fetcher.mockImplementation(async (url, init) => {
      const body = JSON.parse(String(init?.body));
      const auth = new Headers(init?.headers).get("authorization");
      if (String(url).startsWith("https://api.deepseek.com")) {
        expect(auth).toBe(`Bearer ${apiKey}`);
        expect(body.model).toBe("chosen-deepseek");
        if (chatTurns++ === 0)
          return response({ role: "assistant", content: null, tool_calls: [tool] }, "tool_calls");
        expect(body.messages.at(-1).content).toContain("Readable retrieval https://example.com");
        expect(JSON.stringify(body)).not.toContain("ENCRYPTED");
        return response({ role: "assistant", content: "DeepSeek final answer" });
      }
      expect(String(url)).toMatch(/^https:\/\/api.moonshot.cn\/v1\//);
      expect(auth).toBe("Bearer legacy-retrieval-key");
      expect(JSON.stringify(body)).not.toContain("private conversation sentinel");
      expect(JSON.stringify(body)).not.toContain(apiKey);
      if (String(url).endsWith("/fibers"))
        return Response.json({
          status: "succeeded",
          context: { encrypted_output: "MOONSHOT ENCRYPTED test" },
        });
      return bridgeTurns++ === 0
        ? response(
            { role: "assistant", content: null, reasoning_content: "private", tool_calls: [tool] },
            "tool_calls",
          )
        : response({ role: "assistant", content: "Readable retrieval https://example.com" });
    });
    const model = await f.service.resolve(
      run({ connectionId: connection.id, modelId: "chosen-deepseek" }),
    );
    expect(await model?.complete(input, new AbortController().signal)).toBe(
      "DeepSeek final answer",
    );
    expect(f.fetcher).toHaveBeenCalledTimes(5);
  });
  it("does not guess a saved retrieval account and refuses disabled explicit configuration", async () => {
    const f = fixture({ OPENBOT_WEB_SEARCH_CONNECTION_ID: "connection-1" });
    const selected = await f.create();
    const search = await f.create("kimi", "https://api.moonshot.cn/v1");
    await f.service.update(search.id, { expectedRevision: 1, enabled: false });
    await expect(
      f.service.resolve(run({ connectionId: selected.id, modelId: "chosen" })),
    ).rejects.toThrow(/停用/);
    expect(f.fetcher).not.toHaveBeenCalled();
  });
});
