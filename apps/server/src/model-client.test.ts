import { serverEnvSchema } from "@openbot/config";
import { describe, expect, it, vi } from "vitest";
import {
  type ConfiguredModelOptions,
  createConfiguredModel,
  createKimiModel,
  discoverModels,
  type ModelChatInput,
  maximumDiscoveredModels,
} from "./model-client.js";

const key = "test-model-key-never-publish";
const env = serverEnvSchema.parse({
  OPENBOT_OWNER_PASSWORD: "test-owner-password",
  MOONSHOT_API_KEY: key,
});

const configuredOptions: ConfiguredModelOptions = {
  presetId: "deepseek",
  protocol: "openai-chat",
  baseUrl: "https://api.deepseek.com",
  apiKey: key,
  modelId: "deepseek-v4-flash",
  maxTokens: 4096,
  timeoutMs: 1000,
};
const claudeOptions: ConfiguredModelOptions = {
  ...configuredOptions,
  presetId: "anthropic",
  protocol: "anthropic-messages",
  baseUrl: "https://api.anthropic.com",
  modelId: "claude-sonnet-5",
};
function claudeResponse(content: unknown, stopReason = "end_turn") {
  return Response.json({
    id: "msg-test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 2 },
  });
}

describe("configured model request boundaries", () => {
  it.each([
    ["openai", "gpt-5.6-terra", "max_completion_tokens", undefined],
    ["kimi", "kimi-k3", "max_completion_tokens", "low"],
    ["kimi", "kimi-k2.6", "max_tokens", undefined],
    ["deepseek", "deepseek-v4-flash", "max_tokens", undefined],
    ["gemini", "gemini-3.8-flash", "max_tokens", undefined],
    ["minimax", "MiniMax-M3", "max_tokens", undefined],
    ["custom", "vendor/model:version", "max_tokens", undefined],
  ])("applies only reviewed %s parameters", async (presetId, modelId, tokenField, effort) => {
    const fetcher = vi.fn<typeof fetch>(async () => response());
    const model = createConfiguredModel({ ...configuredOptions, presetId, modelId }, fetcher);
    expect(await model.complete(input, new AbortController().signal)).toBe("橙色");
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.deepseek.com/chat/completions");
    expect(init?.redirect).toBe("error");
    const payload = JSON.parse(String(init?.body));
    expect(payload.model).toBe(modelId);
    expect(payload[tokenField]).toBe(4096);
    expect(
      payload[tokenField === "max_tokens" ? "max_completion_tokens" : "max_tokens"],
    ).toBeUndefined();
    expect(payload.reasoning_effort).toBe(effort);
    expect(payload.reasoning_split).toBe(presetId === "minimax" ? true : undefined);
    expect(payload.temperature).toBeUndefined();
    expect(payload.thinking).toBeUndefined();
    expect(payload.tools).toBeUndefined();
    expect(payload.messages.map((item: { role: string }) => item.role)).toEqual(["system", "user"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses native Anthropic messages and exposes only redacted visible text", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      claudeResponse([
        { type: "thinking", thinking: "private-reasoning", signature: "private-signature" },
        { type: "redacted_thinking", data: "private-data" },
        { type: "text", text: `Visible ${key}` },
        { type: "text", text: "Another paragraph" },
      ]),
    );
    const model = createConfiguredModel(claudeOptions, fetcher);
    expect(await model.complete(input, new AbortController().signal)).toBe(
      "Visible [REDACTED]\nAnother paragraph",
    );
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
    expect(init?.redirect).toBe("error");
    const headers = new Headers(init?.headers);
    expect(headers.get("x-api-key")).toBe(key);
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({ model: "claude-sonnet-5", max_tokens: 4096, stream: false });
    expect(typeof payload.system).toBe("string");
    expect(payload.messages.map((item: { role: string }) => item.role)).toEqual(["user"]);
    expect(JSON.parse(payload.messages[0].content).previousExchanges).toEqual(input.history);
    expect(payload.tools).toBeUndefined();
  });

  it("does not inherit ambient Anthropic authentication into a saved connection", async () => {
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "unrelated-ambient-token");
    try {
      const fetcher = vi.fn<typeof fetch>(async () =>
        claudeResponse([{ type: "text", text: "ok" }]),
      );
      await createConfiguredModel(claudeOptions, fetcher).complete(
        input,
        new AbortController().signal,
      );
      const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
      expect(headers.get("x-api-key")).toBe(key);
      expect(headers.get("authorization")).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects MiniMax output if the service did not separate private reasoning", async () => {
    const model = createConfiguredModel({ ...configuredOptions, presetId: "minimax" }, async () =>
      response({ content: "<think>private reasoning</think>Visible answer" }),
    );
    await expect(model.complete(input, new AbortController().signal)).rejects.toThrow();
  });

  it.each([
    [[{ type: "text", text: "partial" }], "max_tokens"],
    [[{ type: "text", text: "working" }], "pause_turn"],
    [[{ type: "thinking", thinking: "private only" }], "end_turn"],
    [[{ type: "text", text: "x".repeat(16001) }], "end_turn"],
    [[{ type: "text", text: "" }], "end_turn"],
    [[{ type: "tool_use", name: "exec", id: "tool", input: {} }], "end_turn"],
    [
      [
        { type: "image", source: {} },
        { type: "text", text: "visible" },
      ],
      "end_turn",
    ],
    [[null], "end_turn"],
  ])("rejects incomplete or unsupported Anthropic output", async (content, finish) => {
    const model = createConfiguredModel(claudeOptions, async () => claudeResponse(content, finish));
    await expect(model.complete(input, new AbortController().signal)).rejects.toThrow();
  });

  it.each([configuredOptions, claudeOptions])(
    "sanitizes upstream errors without retrying $presetId",
    async (options) => {
      const fetcher = vi.fn<typeof fetch>(async () =>
        Response.json(
          { error: { message: `private ${key}`, type: "invalid_request_error" } },
          { status: 401 },
        ),
      );
      const model = createConfiguredModel(options, fetcher);
      await expect(model.complete(input, new AbortController().signal)).rejects.toThrow(
        "模型服务请求失败（HTTP 401），请检查服务端配置与额度。",
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it.each([configuredOptions, claudeOptions])(
    "cancels an uncooperative response body for $presetId",
    async (options) => {
      const cancelled = vi.fn();
      const model = createConfiguredModel(
        { ...options, timeoutMs: 20 },
        async () =>
          new Response(new ReadableStream({ cancel: cancelled }), {
            headers: { "content-type": "application/json" },
          }),
      );
      await expect(model.complete(input, new AbortController().signal)).rejects.toThrow("超时");
      expect(cancelled).toHaveBeenCalled();
    },
  );
});

describe("bounded model discovery", () => {
  it.each([
    ["openai", ""],
    ["deepseek", ""],
    ["kimi", ""],
    ["gemini", ""],
    ["minimax", ""],
    ["openrouter", "?output_modalities=text"],
    ["siliconflow", "?type=text&sub_type=chat"],
    ["custom", ""],
  ])("uses a single filtered SDK page for %s", async (presetId, query) => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        data: [{ id: "vendor/model:version" }, { id: "vendor/model:version" }, { id: "gpt-test" }],
        has_more: true,
        last_id: "gpt-test",
      }),
    );
    expect(
      await discoverModels(
        { ...configuredOptions, presetId },
        new AbortController().signal,
        fetcher,
      ),
    ).toEqual(["vendor/model:version", "gpt-test"]);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe(`https://api.deepseek.com/models${query}`);
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("error");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses Anthropic pagination limits but never follows subsequent pages", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        data: [{ id: "claude-sonnet-5" }],
        has_more: true,
        last_id: "claude-sonnet-5",
      }),
    );
    expect(await discoverModels(claudeOptions, new AbortController().signal, fetcher)).toEqual([
      "claude-sonnet-5",
    ]);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.anthropic.com/v1/models?limit=256");
    expect(new Headers(init?.headers).get("x-api-key")).toBe(key);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("bounds returned IDs, rejects unsafe names, and discards key echoes", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        data: [
          null,
          {},
          { id: 12 },
          { id: "unsafe\nname" },
          { id: "<script>" },
          { id: key },
          { id: "x".repeat(257) },
          ...Array.from({ length: 400 }, (_, index) => ({ id: `vendor/model-${index}` })),
        ],
      }),
    );
    const ids = await discoverModels(configuredOptions, new AbortController().signal, fetcher);
    expect(ids).toHaveLength(maximumDiscoveredModels);
    expect(ids[0]).toBe("vendor/model-0");
    expect(ids.at(-1)).toBe("vendor/model-255");
  });

  it.each(["dashscope", "zai", "ark", "unknown"])(
    "requires manual IDs for %s without sending credentials",
    async (presetId) => {
      const fetcher = vi.fn<typeof fetch>();
      await expect(
        discoverModels({ ...configuredOptions, presetId }, new AbortController().signal, fetcher),
      ).rejects.toThrow("手动输入");
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("allows catalog metadata over the chat byte limit but cancels over 2 MiB", async () => {
    const largeMetadata = "m".repeat(300_000);
    expect(
      await discoverModels(configuredOptions, new AbortController().signal, async () =>
        Response.json({ data: [{ id: "model", description: largeMetadata }] }),
      ),
    ).toEqual(["model"]);
    const cancelled = vi.fn();
    await expect(
      discoverModels(
        configuredOptions,
        new AbortController().signal,
        async () =>
          new Response(
            new ReadableStream({
              pull(controller) {
                controller.enqueue(new Uint8Array(1_000_000));
              },
              cancel: cancelled,
            }),
            { headers: { "content-type": "application/json" } },
          ),
      ),
    ).rejects.toThrow();
    expect(cancelled).toHaveBeenCalled();
  });

  it("honors preflight cancellation without fetching model lists", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<typeof fetch>();
    await expect(discoverModels(configuredOptions, controller.signal, fetcher)).rejects.toThrow(
      "取消",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
const input: ModelChatInput = {
  name: "Researcher",
  role: "Answer questions",
  instruction: "What did I say?",
  history: [{ instruction: "My word is orange", reply: "Acknowledged" }],
};
function response(
  message: Record<string, unknown> = { content: "橙色", reasoning_content: "private-reasoning" },
  finish = "stop",
) {
  return Response.json({
    id: "completion-test",
    object: "chat.completion",
    created: 1,
    model: "kimi-k3",
    choices: [{ index: 0, finish_reason: finish, message: { role: "assistant", ...message } }],
  });
}

describe("Kimi model boundary", () => {
  it("uses the pinned SDK with K3 parameters and publishes only visible content", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response());
    const model = createKimiModel(env, fetcher);
    expect(await model?.complete(input, new AbortController().signal)).toBe("橙色");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.moonshot.cn/v1/chat/completions");
    expect(init?.redirect).toBe("error");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${key}`);
    const request = JSON.parse(String(init?.body));
    expect(request).toMatchObject({
      model: "kimi-k3",
      max_completion_tokens: 4096,
      reasoning_effort: "low",
      stream: false,
    });
    expect(request.tools.map((tool: { function: { name: string } }) => tool.function.name)).toEqual(
      ["web_search", "fetch"],
    );
    expect(request.messages.map((item: { role: string }) => item.role)).toEqual(["system", "user"]);
    expect(JSON.parse(request.messages[1].content)).toMatchObject({
      previousExchanges: input.history,
      currentRequest: input.instruction,
    });
    expect(String(init?.body)).not.toContain(key);
  });

  it("does not create a client without a configured key", () => {
    expect(
      createKimiModel(serverEnvSchema.parse({ OPENBOT_OWNER_PASSWORD: "test-owner-password" })),
    ).toBeUndefined();
  });

  it.each([
    [{ content: "" }, "stop"],
    [{ content: "partial" }, "length"],
    [
      {
        content: "run this",
        tool_calls: [{ id: "x", type: "function", function: { name: "exec", arguments: "{}" } }],
      },
      "stop",
    ],
    [{ content: "x".repeat(16001) }, "stop"],
    [{ reasoning_content: "private only" }, "stop"],
  ])("rejects incomplete, oversized, or tool-bearing output", async (message, finish) => {
    const model = createKimiModel(env, async () => response(message, finish));
    await expect(model?.complete(input, new AbortController().signal)).rejects.toThrow();
  });

  it("redacts an echoed key and never exposes reasoning_content", async () => {
    const model = createKimiModel(env, async () =>
      response({ content: `Visible ${key}`, reasoning_content: key }),
    );
    expect(await model?.complete(input, new AbortController().signal)).toBe("Visible [REDACTED]");
  });

  it("sanitizes API failures without retrying a paid request", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: { message: `upstream leaked ${key}`, type: "limit" } },
        { status: 429 },
      ),
    );
    const model = createKimiModel(env, fetcher);
    await expect(model?.complete(input, new AbortController().signal)).rejects.toThrow("HTTP 429");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("bounds received bytes and cancels an oversized body", async () => {
    const cancelled = vi.fn();
    const model = createKimiModel(
      env,
      async () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              controller.enqueue(new Uint8Array(200_000));
            },
            cancel: cancelled,
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );
    await expect(model?.complete(input, new AbortController().signal)).rejects.toThrow();
    expect(cancelled).toHaveBeenCalled();
  });

  it("rejects excessive context before sending it upstream", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const model = createKimiModel(env, fetcher);
    await expect(
      model?.complete(
        { ...input, history: [{ instruction: "x".repeat(8000), reply: "x".repeat(16000) }] },
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("aborts a response body that stalls after headers", async () => {
    const localEnv = { ...env, OPENBOT_MODEL_TIMEOUT_MS: 30 };
    const model = createKimiModel(
      localEnv,
      async (_url, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener(
                "abort",
                () => controller.error(new Error("aborted")),
                { once: true },
              );
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );
    await expect(model?.complete(input, new AbortController().signal)).rejects.toThrow("超时");
  });

  it("honors shutdown cancellation", async () => {
    const abort = new AbortController();
    abort.abort();
    const fetcher = vi.fn<typeof fetch>();
    const model = createKimiModel(env, fetcher);
    await expect(model?.complete(input, abort.signal)).rejects.toThrow("取消");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
