import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentModelSettings } from "./model-settings.js";
import {
  createNativeWebSearch,
  webFetchInputSchema,
  webSearchInputSchema,
} from "./native-web-tools.js";

const config: AgentModelSettings = {
  provider: "moonshot",
  model: "kimi-k3",
  apiKey: "synthetic-moonshot-key",
  revision: "00000000-0000-4000-8000-000000000001",
  agentEnabled: true,
  agentEnabledAt: "2026-09-08T00:00:00.000Z",
};
const input = { query: "public research" };
const signal = () => new AbortController().signal;
const formula = (output = "Readable source https://example.com") =>
  Response.json({ status: "succeeded", context: { output } });
const tavily = (content = "Public source evidence") =>
  Response.json({
    results: [
      { url: "https://example.com", title: "Source", content, published_date: "2026-09-08" },
    ],
  });

afterEach(() => vi.restoreAllMocks());

describe("native public search transport", () => {
  it.each(["https://api.moonshot.cn/v1", "https://api.moonshot.ai/v1"])(
    "binds selected Kimi credentials to the exact %s Formula endpoint",
    async (baseUrl) => {
      const ciphertext = "----MOONSHOT ENCRYPTED BEGIN----opaque\nvalue";
      const fetcher = vi.fn<typeof fetch>(async (url, init) => {
        expect(String(url)).toBe(`${baseUrl}/formulas/moonshot/web-search:latest/fibers`);
        expect(init).toMatchObject({
          method: "POST",
          redirect: "error",
          signal: expect.any(AbortSignal),
        });
        expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${config.apiKey}`);
        expect(JSON.parse(String(init?.body))).toEqual({
          name: "web_search",
          arguments: JSON.stringify(input),
        });
        return Response.json({ status: "succeeded", context: { encrypted_output: ciphertext } });
      });
      const search = createNativeWebSearch({ ...config, baseUrl }, { fetcher });
      expect(await search?.search({ query: " public research " }, signal())).toBe(ciphertext);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it("prefers independent Tavily credentials and returns only bounded readable evidence", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      expect(String(url)).toBe("https://api.tavily.com/search");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-tavily-key");
      expect(JSON.stringify(init)).not.toContain(config.apiKey);
      expect(JSON.parse(String(init?.body))).toEqual({
        query: input.query,
        max_results: 5,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
      });
      return tavily();
    });
    const search = createNativeWebSearch(config, { tavilyApiKey: "synthetic-tavily-key", fetcher });
    const output = await search?.search(input, signal());
    expect(JSON.parse(output ?? "")).toMatchObject({
      provider: "tavily",
      retrievedAt: expect.any(String),
      results: [
        {
          url: "https://example.com",
          title: "Source",
          content: "Public source evidence",
          publishedAt: "2026-09-08",
        },
      ],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const other = createNativeWebSearch(
      { ...config, provider: "openai" },
      { tavilyApiKey: "synthetic-tavily-key", fetcher },
    );
    expect(await other?.search(input, signal())).toContain("Public source evidence");
  });

  it("does not grant another provider or a substituted endpoint Formula authority", () => {
    const fetcher = vi.fn();
    for (const change of [
      { provider: "openai" as const },
      { provider: "deepseek" as const },
      { baseUrl: "https://api.moonshot.cn.evil.example/v1" },
      { baseUrl: "https://api.moonshot.cn/v1/other" },
      { baseUrl: "http://api.moonshot.cn/v1" },
      { baseUrl: "https://user:password@api.moonshot.cn/v1" },
    ])
      expect(createNativeWebSearch({ ...config, ...change }, { fetcher })).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { query: " " },
    { query: "x".repeat(1001) },
    { query: "public", url: "https://example.com" },
  ])("rejects invalid input before either backend receives a request: %j", async (invalid) => {
    const fetcher = vi.fn();
    for (const options of [{ fetcher }, { fetcher, tavilyApiKey: "synthetic-tavily-key" }]) {
      const search = createNativeWebSearch(config, options);
      await expect(search?.search(invalid as { query: string }, signal())).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("exports strict schemas for both Agent tool declarations", () => {
    expect(webSearchInputSchema.parse({ query: " public " })).toEqual({ query: "public" });
    expect(webFetchInputSchema.safeParse({ url: "https://example.com" }).success).toBe(true);
    for (const value of [
      { url: "invalid" },
      { url: "https://example.com", headers: {} },
      { url: `https://example.com/${"x".repeat(2048)}` },
    ])
      expect(webFetchInputSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    () => Response.json({ secret: "private-upstream" }, { status: 503 }),
    () => Response.json({}, { status: 302, headers: { location: "https://evil.example" } }),
    () =>
      new Response("private malformed body", { headers: { "content-type": "application/json" } }),
    () => new Response("{}", { headers: { "content-type": "text/html" } }),
    () => new Response(null, { status: 204 }),
    () => Response.json({ status: "failed", context: { output: "private-upstream" } }),
    () => Response.json({ status: "succeeded", context: { output: 1 } }),
    () => Response.json({ status: "succeeded", context: {} }),
    () => formula("   "),
  ])("fails closed without retrying unsuccessful or malformed responses", async (response) => {
    const fetcher = vi.fn<typeof fetch>(async () => response());
    await expect(
      createNativeWebSearch(config, { fetcher })?.search(input, signal()),
    ).rejects.toMatchObject({ code: "tool_unavailable" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("sanitizes transport errors rather than exposing upstream request bodies", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error("private-upstream");
    });
    await expect(
      createNativeWebSearch(config, { fetcher })?.search(input, signal()),
    ).rejects.toMatchObject({ code: "tool_unavailable" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["x".repeat(100001), "汉".repeat(50000), "\u0000".repeat(30000)])(
    "rejects oversized Formula output without truncating it",
    async (content) => {
      const fetcher = vi.fn<typeof fetch>(async () => formula(content));
      await expect(
        createNativeWebSearch(config, { fetcher })?.search(input, signal()),
      ).rejects.toMatchObject({ code: "task_limit" });
    },
  );

  it("accepts complete Formula output at the character limit", async () => {
    const content = "x".repeat(100000);
    const fetcher = vi.fn<typeof fetch>(async () => formula(content));
    expect(await createNativeWebSearch(config, { fetcher })?.search(input, signal())).toBe(content);
  });

  it("bounds the body before JSON parsing and cancels excess streaming bytes", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(256 * 1024 + 1));
      },
      cancel,
    });
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(body, { headers: { "content-type": "application/json" } }),
    );
    await expect(
      createNativeWebSearch(config, { fetcher })?.search(input, signal()),
    ).rejects.toMatchObject({ code: "task_limit" });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });

  it("compacts Unicode Tavily excerpts within 16 KiB with explicit truncation and source URLs", async () => {
    const results = Array.from({ length: 5 }, (_, index) => ({
      url: `https://example.com/${index}/${"a".repeat(1900)}`,
      title: "标题".repeat(100),
      content: "内容\u0000".repeat(3000),
    }));
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ results }));
    const output = await createNativeWebSearch(config, {
      fetcher,
      tavilyApiKey: "synthetic-tavily-key",
    })?.search(input, signal());
    expect(Buffer.byteLength(output ?? "")).toBeLessThanOrEqual(16 * 1024);
    const parsed = JSON.parse(output ?? "");
    expect(parsed.results).toHaveLength(5);
    expect(parsed.results.map((item: { url: string }) => item.url)).toEqual(
      results.map((item) => item.url),
    );
    expect(
      parsed.results.every(
        (item: { truncated: boolean; content: string }) =>
          item.truncated && !item.content.includes("�"),
      ),
    ).toBe(true);
  });

  it.each([
    { results: [] },
    { results: [{ url: "invalid", title: "Source", content: "Evidence" }] },
    { results: [{ url: "https://example.com", title: "Source", content: "" }] },
  ])("rejects missing or malformed Tavily evidence", async (body) => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(body));
    await expect(
      createNativeWebSearch(config, { fetcher, tavilyApiKey: "synthetic-tavily-key" })?.search(
        input,
        signal(),
      ),
    ).rejects.toMatchObject({ code: "tool_unavailable" });
  });

  it("does not dispatch after parent cancellation", async () => {
    const parent = new AbortController();
    const reason = new Error("synthetic cancellation");
    parent.abort(reason);
    const fetcher = vi.fn();
    await expect(
      createNativeWebSearch(config, { fetcher })?.search(input, parent.signal),
    ).rejects.toBe(reason);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["parent", "deadline"])("cancels a stalled response body on %s abort", async (mode) => {
    const parent = new AbortController();
    const timeout = new AbortController();
    const timeoutFactory = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    let requestSignal: AbortSignal | undefined;
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      requestSignal = init?.signal ?? undefined;
      return new Response(body, { headers: { "content-type": "application/json" } });
    });
    const pending = createNativeWebSearch(config, { fetcher })?.search(input, parent.signal);
    const rejection = expect(pending).rejects.toMatchObject(
      mode === "parent" ? { message: "synthetic cancellation" } : { code: "task_timeout" },
    );
    await vi.waitFor(() => expect(body.locked).toBe(true));
    expect(timeoutFactory).toHaveBeenCalledWith(20000);
    (mode === "parent" ? parent : timeout).abort(new Error("synthetic cancellation"));
    await rejection;
    expect(requestSignal?.aborted).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });
});
