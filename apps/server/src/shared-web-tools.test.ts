import { describe, expect, it, vi } from "vitest";
import {
  type ConfiguredModelOptions,
  createConfiguredModel,
  createKimiWebExecutor,
} from "./model-client.js";
import { modelProviderPresets } from "./model-provider-presets.js";
import { WebToolSession } from "./model-web-tools.js";
import { createTavilyWebExecutor } from "./tavily-web-tools.js";

const input = {
  name: "Test",
  role: "Research",
  instruction: "Search current information",
  history: [],
};
const options: ConfiguredModelOptions = {
  presetId: "deepseek",
  protocol: "openai-chat",
  baseUrl: "https://api.deepseek.com",
  apiKey: "chat-secret",
  modelId: "test-model",
  maxTokens: 4096,
  timeoutMs: 1000,
};
const call = {
  id: "one",
  type: "function",
  function: { name: "web_search", arguments: '{"query":"public query"}' },
  extra_content: { google: { thought_signature: "signed-opaque-state" } },
};
const first = {
  role: "assistant",
  content: null,
  reasoning_content: "private reasoning",
  tool_calls: [call],
};
const answer = { role: "assistant", content: "Verified [source](https://example.com)" };
const chat = (message: unknown, finish_reason = "stop") =>
  Response.json({ choices: [{ finish_reason, message }] });

// Each registered preset must exercise a continuation, not just accept a tools declaration.
describe("shared web tools across providers", () => {
  it.each(modelProviderPresets.filter((p) => p.protocol === "openai-chat").map((p) => p.id))(
    "completes a real protocol continuation for %s",
    async (presetId) => {
      const execute = vi.fn(async () => "Readable source https://example.com");
      let count = 0;
      const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        expect(body.model).toBe("selected-model");
        expect(body.tools.map((t: { function: { name: string } }) => t.function.name)).toEqual([
          "web_search",
          "fetch",
        ]);
        if (count++ === 0) return chat(first, "tool_calls");
        expect(body.messages[2]).toEqual(first);
        expect(body.messages[3]).toEqual({
          role: "tool",
          tool_call_id: "one",
          content: "Readable source https://example.com",
        });
        return chat(answer);
      });
      const result = await createConfiguredModel(
        { ...options, presetId, modelId: "selected-model", webExecutor: { execute } },
        fetcher,
      ).complete(input, new AbortController().signal);
      expect(result).toContain("Verified");
      expect(result).not.toContain("private reasoning");
      expect(execute).toHaveBeenCalledExactlyOnceWith(
        "web_search",
        call.function.arguments,
        expect.any(AbortSignal),
      );
    },
  );
  it("uses Claude tool_use/tool_result with preserved thinking and signed content", async () => {
    const blocks = [
      { type: "thinking", thinking: "private thinking", signature: "signature" },
      { type: "tool_use", id: "a", name: "web_search", input: { query: "public query" } },
      { type: "tool_use", id: "b", name: "fetch", input: { url: "https://example.com" } },
    ];
    let count = 0;
    const fetcher: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.tools[0].input_schema.type).toBe("object");
      expect(body.system).not.toContain("You have no tools");
      if (count++ === 0)
        return Response.json({
          id: "msg",
          role: "assistant",
          type: "message",
          stop_reason: "tool_use",
          content: blocks,
        });
      expect(body.messages[1].content).toEqual(blocks);
      expect(body.messages[2]).toEqual({
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "a", content: "source" },
          { type: "tool_result", tool_use_id: "b", content: "source" },
        ],
      });
      return Response.json({
        id: "msg",
        type: "message",
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Visible source" }],
      });
    };
    const execute = vi.fn(async () => "source");
    expect(
      await createConfiguredModel(
        {
          ...options,
          presetId: "anthropic",
          protocol: "anthropic-messages",
          baseUrl: "https://api.anthropic.com",
          webExecutor: { execute },
        },
        fetcher,
      ).complete(input, new AbortController().signal),
    ).toBe("Visible source");
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it("refuses an invalid Claude batch before any retrieval", async () => {
    const execute = vi.fn(async () => "source");
    const fetcher: typeof fetch = async () =>
      Response.json({
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "a", name: "web_search", input: { query: "public" } },
          { type: "tool_use", id: "b", name: "shell", input: {} },
        ],
      });
    await expect(
      createConfiguredModel(
        { ...options, protocol: "anthropic-messages", webExecutor: { execute } },
        fetcher,
      ).complete(input, new AbortController().signal),
    ).rejects.toThrow(/联网检索/);
    expect(execute).not.toHaveBeenCalled();
  });
  it("bridges encrypted Kimi evidence to plaintext in exactly one tool execution", async () => {
    let turns = 0;
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (String(url).endsWith("/fibers"))
        return Response.json({
          status: "succeeded",
          context: { encrypted_output: "----MOONSHOT ENCRYPTED BEGIN----ciphertext" },
        });
      if (turns++ === 0) {
        expect(body.tool_choice).toBeUndefined();
        expect(
          body.tools.map((tool: { function: { name: string } }) => tool.function.name),
        ).toEqual(["web_search"]);
        return chat(first, "tool_calls");
      }
      expect(body.tool_choice).toBeUndefined();
      expect(body.messages[3].content).toContain("MOONSHOT ENCRYPTED");
      return chat(answer);
    });
    const executor = createKimiWebExecutor(
      { ...options, presetId: "kimi", baseUrl: "https://api.moonshot.cn/v1" },
      fetcher,
    );
    const result = await executor.execute(
      "web_search",
      call.function.arguments,
      new AbortController().signal,
    );
    expect(result).toContain("retrieval_summary");
    expect(result).not.toContain("ciphertext");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("does not claim bridge success without a completed retrieval", async () => {
    const bridge = createKimiWebExecutor(
      { ...options, presetId: "kimi", baseUrl: "https://api.moonshot.cn/v1" },
      async () => chat(answer),
    );
    await expect(
      bridge.execute("web_search", call.function.arguments, new AbortController().signal),
    ).rejects.toThrow(/可读来源/);
  });
  it("applies shared output limits and never retries executor failure", async () => {
    const execute = vi.fn(async () => "x".repeat(100001));
    const session = new WebToolSession({ execute }, new AbortController().signal);
    await expect(
      session.perform([{ id: "one", name: "web_search", arguments: call.function.arguments }]),
    ).rejects.toThrow(/Invalid tool output/);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe("Tavily retrieval adapter", () => {
  it("uses separate credentials and returns bounded source evidence", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer retrieval-secret");
      expect(String(init?.body)).not.toContain("chat-secret");
      if (String(url).endsWith("/search"))
        return Response.json({
          results: [{ url: "https://example.com", title: "Source", content: "Evidence" }],
        });
      expect(JSON.parse(String(init?.body)).urls).toEqual(["https://example.com"]);
      return Response.json({
        results: [{ url: "https://example.com", raw_content: "0123456789" }],
      });
    });
    const executor = createTavilyWebExecutor("retrieval-secret", fetcher);
    expect(
      await executor.execute("web_search", call.function.arguments, new AbortController().signal),
    ).toContain("Evidence");
    expect(
      JSON.parse(
        await executor.execute(
          "fetch",
          '{"url":"https://example.com","start_index":2,"max_length":4}',
          new AbortController().signal,
        ),
      ).content,
    ).toBe("2345");
  });
  it("refuses private URLs before network access and failed extractions", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ results: [], failed_results: [{ url: "https://example.com" }] }),
    );
    const executor = createTavilyWebExecutor("retrieval-secret", fetcher);
    await expect(
      executor.execute("fetch", '{"url":"http://127.0.0.1/"}', new AbortController().signal),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      executor.execute("fetch", '{"url":"https://example.com"}', new AbortController().signal),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
