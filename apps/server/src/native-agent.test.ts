import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { Run } from "@openbot/domain";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { ChannelRealtimeHub } from "./channel-realtime-hub.js";
import type { ModelSettingsService } from "./model-settings.js";
import {
  type AgentRunStore,
  agentFetch,
  executeAgentRun,
  NativeAgentRunner,
} from "./native-agent.js";

const run: Run = {
  id: "run",
  channelId: "channel",
  botId: "bot",
  executionProfile: "none",
  instruction: "Summarize the current channel",
  title: "Summary",
  status: "running",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 10, text: 10, reasoning: 0 },
};
const answer = (text = "Completed.") => ({
  content: [{ type: "text" as const, text }],
  usage,
  finishReason: { unified: "stop" as const, raw: "stop" },
  warnings: [],
});
const calls = (name = "read_channel_context", input = "{}", count = 1) => ({
  content: Array.from({ length: count }, (_, i) => ({
    type: "tool-call" as const,
    toolCallId: `call-${i}`,
    toolName: name,
    input,
  })),
  usage,
  finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
  warnings: [],
});
function fixture() {
  const store: AgentRunStore = {
    queued: vi.fn(async () => []),
    claim: vi.fn(async () => run),
    assertScope: vi.fn(async () => {}),
    context: vi.fn(async () => [{ author: "human", content: "The launch is Tuesday." }]),
    tasks: vi.fn(async () => [{ title: "Launch", status: "completed" }]),
    progress: vi.fn(async (_run, stage, message) => ({
      id: "progress",
      runId: run.id,
      channelId: run.channelId,
      stage,
      message,
      createdAt: run.createdAt,
    })),
    complete: vi.fn(),
    fail: vi.fn(async () => ({ ...run, status: "failed" })),
  };
  const publish = vi.fn(),
    checkSettings = vi.fn(async () => {});
  return { store, publish, checkSettings, run, signal: new AbortController().signal };
}
describe("native Agent loop", () => {
  it("reads an explicit source, prepares a report, and returns verifiable source metadata", async () => {
    const f = fixture();
    const readSource = vi.fn(async () => ({
      url: "https://example.com/research",
      text: "Launch is Tuesday.",
      truncated: false,
      fetchedAt: "2026-09-08T00:00:00.000Z",
    }));
    const model = new MockLanguageModelV4({
      doGenerate: [
        calls("read_public_page", '{"sourceIndex":0}'),
        calls(
          "write_report",
          JSON.stringify({ name: "研究报告.md", markdown: "# Findings\n\nLaunch is Tuesday." }),
        ),
        answer("The report is attached."),
      ],
    });
    const result = await executeAgentRun({
      ...f,
      run: { ...run, instruction: "Read https://example.com/research and write a report" },
      model,
      allowReports: true,
      readSource,
    });
    expect(readSource).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain("Launch is Tuesday.");
    expect(result.text).toBe("The report is attached.");
    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]).toMatchObject({
      name: "研究报告.md",
      mediaType: "text/markdown",
      metadata: {
        executor: "native-agent",
        sources: [{ url: "https://example.com/research", truncated: false }],
      },
    });
    expect(result.reports[0]?.text).toContain("## Sources read by OpenBot");
    expect(f.store.complete).not.toHaveBeenCalled();
  });

  it("rejects unlisted sources, extra network arguments, unsafe filenames and duplicate reports", async () => {
    for (const [name, input] of [
      ["read_public_page", '{"sourceIndex":1}'],
      ["read_public_page", '{"sourceIndex":0,"url":"https://attacker.example"}'],
      ["write_report", '{"name":"../report.md","markdown":"content"}'],
      ["write_report", '{"name":"report.html","markdown":"content"}'],
    ]) {
      const f = fixture();
      const readSource = vi.fn();
      const model = new MockLanguageModelV4({ doGenerate: [calls(name, input), answer()] });
      await expect(
        executeAgentRun({
          ...f,
          run: { ...run, instruction: "Read https://example.com" },
          model,
          readSource,
          allowReports: true,
        }),
      ).rejects.toThrow();
      expect(readSource).not.toHaveBeenCalled();
    }
    const duplicate = calls("write_report", '{"name":"report.md","markdown":"content"}', 2);
    await expect(
      executeAgentRun({
        ...fixture(),
        model: new MockLanguageModelV4({ doGenerate: [duplicate, answer()] }),
        allowReports: true,
      }),
    ).rejects.toThrow();
  });

  it("does not retain a prepared report when a later model step fails", async () => {
    const f = fixture();
    let step = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        if (++step === 1) return calls("write_report", '{"name":"report.md","markdown":"draft"}');
        throw new Error("upstream failure");
      },
    });
    await expect(executeAgentRun({ ...f, model, allowReports: true })).rejects.toThrow();
    expect(f.store.complete).not.toHaveBeenCalled();
  });

  it.each(["commit-failure", "settings-revoked", "notification-failure"])(
    "keeps report bytes consistent with terminal authority: %s",
    async (mode) => {
      const f = fixture();
      vi.mocked(f.store.queued).mockResolvedValueOnce([run]).mockResolvedValue([]);
      const config = {
        provider: "openai",
        model: "fixture",
        apiKey: "fixture-key",
        revision: "first",
        agentEnabled: true,
        agentEnabledAt: "2026-09-07T00:00:00Z",
      };
      const settings = {
        agentSettings: vi.fn(async () => ({ ...config })),
        onChange: () => () => {},
      } as unknown as ModelSettingsService;
      const artifact = {
        id: "report",
        runId: run.id,
        name: "report.md",
        mediaType: "text/markdown",
        sha256: "a".repeat(64),
        sizeBytes: 10,
        createdAt: run.createdAt,
      };
      const record = { artifact, storageKey: "runs/run/report.md", metadata: {} };
      const storage = {
        persist: vi.fn(async () => {
          if (mode === "settings-revoked") config.revision = "second";
          return [record];
        }),
        read: vi.fn(),
        remove: vi.fn(async () => {}),
      };
      vi.mocked(f.store.complete).mockImplementation(async () => {
        if (mode === "commit-failure") throw new Error("transaction failed");
        return {
          run: { ...run, status: "completed" },
          artifacts: [artifact],
          message: {
            id: "reply",
            channelId: run.channelId,
            authorType: "bot",
            authorId: run.botId,
            content: "Attached.",
            createdAt: run.createdAt,
          },
        };
      });
      const realtime = new ChannelRealtimeHub();
      if (mode === "notification-failure")
        realtime.subscribe(run.channelId, (event) => {
          if (event.type === "message.created") throw new Error("listener failed after commit");
        });
      const error = vi.fn();
      const model = new MockLanguageModelV4({
        doGenerate: [calls("write_report", '{"name":"report.md","markdown":"a report"}'), answer()],
      });
      const runner = new NativeAgentRunner(f.store, settings, realtime, error, () => model, {
        artifacts: storage,
      });
      try {
        runner.start();
        await vi.waitFor(() => {
          if (mode === "notification-failure") expect(error).toHaveBeenCalledTimes(1);
          else expect(f.store.fail).toHaveBeenCalledTimes(1);
        });
        if (mode === "notification-failure") {
          expect(storage.remove).not.toHaveBeenCalled();
          expect(f.store.fail).not.toHaveBeenCalled();
        } else {
          expect(storage.remove).toHaveBeenCalledWith([record.storageKey]);
          if (mode === "settings-revoked") expect(f.store.complete).not.toHaveBeenCalled();
        }
      } finally {
        await runner.stop();
      }
    },
  );
  it("returns a scoped observation to the model and completes on the next step", async () => {
    const f = fixture();
    const model = new MockLanguageModelV4({
      doGenerate: [calls(), answer("The launch is Tuesday.")],
    });
    expect(await executeAgentRun({ ...f, model })).toEqual({
      text: "The launch is Tuesday.",
      reports: [],
    });
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain("The launch is Tuesday.");
    expect(f.store.context).toHaveBeenCalledWith(run);
    expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(1024);
    expect(f.publish.mock.calls.map(([event]) => event.stage)).toEqual([
      "planning",
      "observation",
      "planning",
    ]);
  });
  it.each([
    ["delete_file", "{}"],
    ["read_channel_context", '{"channelId":"other"}'],
    ["read_task_status", "not-json"],
  ])("rejects unavailable tools and invalid inputs: %s", async (name, input) => {
    const f = fixture();
    const model = new MockLanguageModelV4({ doGenerate: [calls(name, input), answer()] });
    await expect(executeAgentRun({ ...f, model })).rejects.toThrow();
    expect(f.store.context).not.toHaveBeenCalled();
    expect(f.store.tasks).not.toHaveBeenCalled();
    expect(model.doGenerateCalls).toHaveLength(1);
  });
  it("fails when five tool steps do not reach a final answer", async () => {
    const f = fixture();
    const model = new MockLanguageModelV4({ doGenerate: calls() });
    await expect(executeAgentRun({ ...f, model })).rejects.toThrow(/limits/);
    expect(model.doGenerateCalls).toHaveLength(5);
  });
  it("bounds parallel tools to eight actual reads", async () => {
    const f = fixture();
    const model = new MockLanguageModelV4({
      doGenerate: [calls("read_channel_context", "{}", 9), answer()],
    });
    await expect(executeAgentRun({ ...f, model })).rejects.toThrow();
    expect(f.store.context).toHaveBeenCalledTimes(8);
    expect(model.doGenerateCalls).toHaveLength(1);
  });
  it("does not retry a provider error", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("private provider error");
      },
    });
    await expect(executeAgentRun({ ...fixture(), model })).rejects.toThrow();
    expect(model.doGenerateCalls).toHaveLength(1);
  });
  it("stops on changed settings, revoked scope, cancellation, or excessive output", async () => {
    for (const kind of ["settings", "scope", "abort", "tool-size", "final-size"]) {
      const f = fixture();
      if (kind === "settings") f.checkSettings.mockRejectedValue(new Error("changed"));
      if (kind === "scope") vi.mocked(f.store.assertScope).mockRejectedValue(new Error("revoked"));
      if (kind === "abort") f.signal = AbortSignal.abort();
      if (kind === "tool-size") vi.mocked(f.store.context).mockResolvedValue("x".repeat(17000));
      const model = new MockLanguageModelV4({
        doGenerate:
          kind === "tool-size"
            ? [calls(), answer()]
            : answer(kind === "final-size" ? "x".repeat(8001) : "ok"),
      });
      await expect(executeAgentRun({ ...f, model })).rejects.toThrow();
    }
  });
  it("does not poll or instantiate a model without Owner opt-in", async () => {
    const f = fixture();
    const settings = {
      agentSettings: vi.fn(async () => undefined),
      onChange: () => () => {},
    } as unknown as ModelSettingsService;
    const makeModel = vi.fn();
    const runner = new NativeAgentRunner(
      f.store,
      settings,
      new ChannelRealtimeHub(),
      vi.fn(),
      makeModel,
    );
    runner.start();
    await runner.stop();
    expect(f.store.queued).not.toHaveBeenCalled();
    expect(makeModel).not.toHaveBeenCalled();
  });
  it("bounds concurrency, serializes channels, and aborts active inference when settings change", async () => {
    const f = fixture();
    const queued = [
      run,
      { ...run, id: "same-channel" },
      { ...run, id: "other-channel", channelId: "other" },
      { ...run, id: "third-channel", channelId: "third" },
    ];
    vi.mocked(f.store.queued).mockResolvedValue(queued);
    vi.mocked(f.store.claim).mockImplementation(async (candidate) => candidate);
    vi.mocked(f.store.fail).mockImplementation(async (candidate) => ({
      ...candidate,
      status: "failed",
    }));
    const config = {
      provider: "openai" as const,
      model: "test-model",
      apiKey: "fixture-key",
      revision: "initial",
      agentEnabled: true,
      agentEnabledAt: "2026-09-07T00:00:00Z",
    };
    let changed: (() => void) | undefined;
    const current = vi.fn(async () => config);
    const settings = {
      agentSettings: current,
      onChange: (listener: () => void) => {
        changed = listener;
        return () => {};
      },
    } as unknown as ModelSettingsService;
    const model = new MockLanguageModelV4({
      doGenerate: async (options) =>
        new Promise((_resolve, reject) => {
          if (options.abortSignal?.aborted) reject(new Error("aborted"));
          options.abortSignal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        }),
    });
    const realtime = new ChannelRealtimeHub();
    const events: unknown[] = [];
    realtime.subscribe(run.channelId, (event) => events.push(event));
    const runner = new NativeAgentRunner(f.store, settings, realtime, vi.fn(), () => model);
    runner.start();
    try {
      await vi.waitFor(() => expect(model.doGenerateCalls).toHaveLength(2));
      expect(vi.mocked(f.store.claim).mock.calls.map(([candidate]) => candidate.id)).toEqual([
        "run",
        "other-channel",
      ]);
      expect(f.store.queued).toHaveBeenCalledWith(config.agentEnabledAt);
      config.revision = "replaced";
      changed?.();
      await vi.waitFor(() => expect(f.store.fail).toHaveBeenCalledTimes(2));
      expect(f.store.complete).not.toHaveBeenCalled();
      expect(JSON.stringify(events)).not.toContain("fixture-key");
    } finally {
      await runner.stop();
    }
  });
});

describe("official provider HTTP contracts", () => {
  it.each(["openai", "anthropic"] as const)(
    "executes %s tool response followed by final answer through the real SDK",
    async (provider) => {
      const requests: { url: string; body: unknown; headers: Headers }[] = [];
      const fetcher: typeof fetch = async (url, init) => {
        requests.push({
          url: String(url),
          body: JSON.parse(String(init?.body)),
          headers: new Headers(init?.headers),
        });
        const first = requests.length === 1;
        return Response.json(
          provider === "openai"
            ? {
                id: "resp_test",
                object: "response",
                created_at: 1,
                status: "completed",
                model: "test-model",
                error: null,
                incomplete_details: null,
                output: first
                  ? [
                      {
                        type: "function_call",
                        id: "fc_test",
                        call_id: "call_test",
                        name: "read_channel_context",
                        arguments: "{}",
                        status: "completed",
                      },
                    ]
                  : [
                      {
                        type: "message",
                        id: "msg_test",
                        role: "assistant",
                        status: "completed",
                        content: [{ type: "output_text", text: "Tuesday.", annotations: [] }],
                      },
                    ],
                usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
              }
            : {
                id: "msg_test",
                type: "message",
                role: "assistant",
                model: "test-model",
                stop_reason: first ? "tool_use" : "end_turn",
                stop_sequence: null,
                content: first
                  ? [{ type: "tool_use", id: "call_test", name: "read_channel_context", input: {} }]
                  : [{ type: "text", text: "Tuesday." }],
                usage: { input_tokens: 10, output_tokens: 10 },
              },
        );
      };
      const fetch = agentFetch(provider, fetcher);
      const model =
        provider === "openai"
          ? createOpenAI({ apiKey: "fixture-key", fetch }).responses("test-model")
          : createAnthropic({ apiKey: "fixture-key", fetch })("test-model");
      expect(await executeAgentRun({ ...fixture(), model })).toEqual({
        text: "Tuesday.",
        reports: [],
      });
      expect(requests).toHaveLength(2);
      expect(JSON.stringify(requests[1]?.body)).toContain("The launch is Tuesday.");
      expect(requests[0]?.url).toBe(
        provider === "openai"
          ? "https://api.openai.com/v1/responses"
          : "https://api.anthropic.com/v1/messages",
      );
      expect(
        requests[0]?.headers.get(provider === "openai" ? "authorization" : "x-api-key"),
      ).toContain("fixture-key");
    },
  );
  it("rejects redirects, large replies, and endpoint substitution", async () => {
    const redirect = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: "https://other.invalid" } }),
    );
    await expect(
      agentFetch("openai", redirect)("https://api.openai.com/v1/responses", { method: "POST" }),
    ).rejects.toThrow();
    expect(redirect).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ redirect: "manual" }),
    );
    await expect(
      agentFetch("openai", redirect)("https://other.invalid", { method: "POST" }),
    ).rejects.toThrow(/endpoint/);
    expect(redirect).toHaveBeenCalledTimes(1);
    await expect(
      agentFetch("openai", async () => Response.json({ text: "x".repeat(524289) }))(
        "https://api.openai.com/v1/responses",
        { method: "POST" },
      ),
    ).rejects.toThrow(/large/);
  });
});
