import { describe, expect, it, vi } from "vitest";
import { type ConfiguredModelOptions, createConfiguredModel } from "./model-client.js";
import { validateWebCall } from "./model-web-tools.js";

const options: ConfiguredModelOptions = {
  presetId: "kimi",
  protocol: "openai-chat",
  baseUrl: "https://api.moonshot.cn/v1",
  apiKey: "synthetic-web-key",
  modelId: "kimi-k3",
  maxTokens: 4096,
  timeoutMs: 1000,
};
const input = {
  name: "Researcher",
  role: "Research",
  instruction: "Search the current price, with sources.",
  history: [{ instruction: "research", reply: "I have no internet tools." }],
};
const toolCall = (id = "call-1", name = "web_search", args = '{"query":"current price"}') => ({
  id,
  type: "function",
  function: { name, arguments: args },
});
function completion(calls?: unknown[]) {
  return Response.json({
    id: "chat",
    choices: [
      {
        finish_reason: calls ? "tool_calls" : "stop",
        message: {
          role: "assistant",
          reasoning_content: "private-test-reasoning",
          content: calls ? null : "Verified [source](https://example.com/product).",
          ...(calls ? { tool_calls: calls } : {}),
        },
      },
    ],
  });
}
const fiber = () =>
  Response.json({
    status: "succeeded",
    context: { encrypted_output: "provider-encrypted-result" },
  });

describe("model public web tools", () => {
  it("searches, reads and resumes with matching IDs and ephemeral complete K3 state", async () => {
    const requests: Array<{
      url: string;
      body: {
        messages: Array<{
          role: string;
          content: string;
          reasoning_content?: string;
          tool_call_id?: string;
        }>;
        tools?: unknown[];
      };
    }> = [];
    let turns = 0;
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      if (String(url).endsWith("/fibers")) return fiber();
      turns++;
      if (turns === 1) return completion([toolCall()]);
      if (turns === 2)
        return completion([toolCall("call-2", "fetch", '{"url":"https://example.com/product"}')]);
      return completion();
    });
    const events: string[] = [];
    const result = await createConfiguredModel(options, fetcher).complete(
      input,
      new AbortController().signal,
      {
        onTool: async (name, phase) => {
          events.push(`${name}:${phase}`);
        },
      },
    );
    expect(result).toBe("Verified [source](https://example.com/product).");
    expect(result).not.toContain("private-test-reasoning");
    expect(events).toEqual([
      "web_search:started",
      "web_search:completed",
      "fetch:started",
      "fetch:completed",
    ]);
    expect(requests[0]?.body.messages[0].content).not.toContain("You have no tools");
    expect(requests[1]).toEqual({
      url: "https://api.moonshot.cn/v1/formulas/moonshot/web-search:latest/fibers",
      body: toolCall().function,
    });
    expect(requests[2]?.body.messages[2].reasoning_content).toBe("private-test-reasoning");
    expect(requests[2]?.body.messages[3]).toEqual({
      role: "tool",
      tool_call_id: "call-1",
      content: "provider-encrypted-result",
    });
    expect(requests[4]?.body.tools).toHaveLength(2);
    expect(JSON.stringify(events)).not.toContain("current price");
  });
  it.each([
    [toolCall("x", "shell", "{}")],
    [toolCall("x"), toolCall("x")],
    [toolCall("x", "web_search", "not-json")],
    [toolCall("x", "web_search", JSON.stringify({ query: "x".repeat(1001) }))],
    [toolCall("x", "fetch", '{"url":"http://127.0.0.1/admin"}')],
    [toolCall("x", "fetch", '{"url":"https://example.com","raw":true}')],
  ])("rejects a malformed batch before making a tool request", async (...calls) => {
    const fetcher = vi.fn<typeof fetch>(async () => completion(calls));
    await expect(
      createConfiguredModel(options, fetcher).complete(input, new AbortController().signal),
    ).rejects.toThrow(/联网检索/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("stops at four executions and never replays a failed paid request", async () => {
    let count = 0;
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).endsWith("/fibers") ? fiber() : completion([toolCall(`call-${++count}`)]),
    );
    await expect(
      createConfiguredModel(options, fetcher).complete(input, new AbortController().signal),
    ).rejects.toThrow(/调用上限/);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/fibers"))).toHaveLength(4);
    const failed = vi.fn<typeof fetch>(async (url) =>
      String(url).endsWith("/fibers")
        ? Response.json({ secret: "upstream-private" }, { status: 503 })
        : completion([toolCall()]),
    );
    await expect(
      createConfiguredModel(options, failed).complete(input, new AbortController().signal),
    ).rejects.toThrow(/联网检索/);
    expect(failed).toHaveBeenCalledTimes(2);
  });
  it("requires audit success before a tool effect", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => completion([toolCall()]));
    await expect(
      createConfiguredModel(options, fetcher).complete(input, new AbortController().signal, {
        onTool: async () => {
          throw new Error("DB unavailable");
        },
      }),
    ).rejects.toThrow(/联网检索/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    { status: "failed", context: { output: "bad" } },
    { status: "succeeded", context: { output: "" } },
    { status: "succeeded", context: { output: "x".repeat(270000) } },
  ])("refuses failed, empty and oversized tool results", async (body) => {
    const fetcher = vi.fn<typeof fetch>(async (url) =>
      String(url).endsWith("/fibers") ? Response.json(body) : completion([toolCall()]),
    );
    await expect(
      createConfiguredModel(options, fetcher).complete(input, new AbortController().signal),
    ).rejects.toThrow(/联网检索/);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("cancels before tool dispatch", async () => {
    const abort = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async () => completion([toolCall()]));
    await expect(
      createConfiguredModel(options, fetcher).complete(input, abort.signal, {
        onTool: async () => {
          abort.abort();
        },
      }),
    ).rejects.toThrow(/取消/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not grant Formula access to other providers or custom endpoints", async () => {
    for (const change of [{ presetId: "custom" }, { baseUrl: "https://custom.example/v1" }]) {
      const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
        expect(JSON.parse(String(init?.body)).tools).toBeUndefined();
        return completion();
      });
      await createConfiguredModel({ ...options, ...change }, fetcher).complete(
        input,
        new AbortController().signal,
      );
    }
  });
  it.each([
    "file:///etc/passwd",
    "http://[::1]/",
    "http://localhost/x",
    "https://user:pass@example.com/",
    "https://host.internal/",
  ])("refuses non-public source %s", (url) => {
    expect(() => validateWebCall("fetch", JSON.stringify({ url }))).toThrow();
  });
});
