import type { ChannelRealtimeEvent, Run, WorkspaceRealtimeEvent } from "@openbot/domain";
import { describe, expect, it, vi } from "vitest";
import type { ModelClient } from "./model-client.js";
import { ModelRunDispatcher, type ModelRunStore } from "./model-run-dispatcher.js";

function fixture(
  initial: Array<Partial<Run> & { id: string }>,
  model: ConstructorParameters<typeof ModelRunDispatcher>[1],
  capacity = 2,
) {
  const runs = initial.map(
    (item) =>
      ({
        channelId: "channel",
        botId: "employee",
        executionProfile: "model",
        instruction: item.id,
        title: "test",
        status: "queued",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...item,
      }) as Run,
  );
  const replies: string[] = [];
  const events: ChannelRealtimeEvent[] = [];
  const workspace: WorkspaceRealtimeEvent[] = [];
  const store: ModelRunStore = {
    async listModelRuns() {
      return runs.filter((run) => run.status === "queued").map((run) => ({ ...run }));
    },
    async claimModelRun(id) {
      const run = runs.find(
        (run) => run.id === id && run.status === "queued" && run.executionProfile === "model",
      );
      if (!run) return undefined;
      run.status = "running";
      return { ...run };
    },
    async getModelInput(run) {
      return {
        name: "Test",
        role: "Test",
        instruction: run.instruction,
        history: replies.map((reply) => ({ instruction: "previous", reply })),
      };
    },
    async completeModelRun(id, reply) {
      const run = runs.find((run) => run.id === id && run.status === "running");
      if (!run) return undefined;
      run.status = "completed";
      run.resultSummary = reply;
      replies.push(reply);
      return {
        run: { ...run },
        artifacts: [],
        message: {
          id: `reply-${id}`,
          channelId: run.channelId,
          authorType: "bot",
          authorId: run.botId,
          runId: id,
          content: reply,
          createdAt: new Date().toISOString(),
        },
      };
    },
    async failModelRun(id, error) {
      const run = runs.find((run) => run.id === id && run.status === "running");
      if (!run) return undefined;
      run.status = "failed";
      run.errorMessage = error;
      return { ...run };
    },
  };
  const dispatcher = new ModelRunDispatcher(
    store,
    model,
    { publish: (event) => events.push(event) },
    { publish: (event) => workspace.push(event) },
    capacity,
  );
  return { dispatcher, store, runs, replies, events, workspace };
}

describe("Server model Run lifecycle", () => {
  it("resolves each Run using its queued model selection", async () => {
    const complete = vi.fn<ModelClient["complete"]>(async () => "selected reply");
    const resolver = vi.fn(async (_run: Run) => ({ complete }));
    const model = { connectionId: "connection-a", modelId: "vendor/model-a" };
    const f = fixture([{ id: "selected", model }], resolver);
    try {
      await f.dispatcher.start();
      await vi.waitFor(() => expect(f.runs[0]?.status).toBe("completed"));
      expect(resolver).toHaveBeenCalledWith(expect.objectContaining({ model }));
      expect(complete).toHaveBeenCalledTimes(1);
    } finally { await f.dispatcher.stop(); }
  });

  it("serializes one conversation, coalesces enqueue, and publishes only committed replies", async () => {
    const complete = vi.fn<ModelClient["complete"]>(async (input) => {
      if (input.instruction === "second")
        expect(input.history).toEqual([{ instruction: "previous", reply: "first reply" }]);
      return `${input.instruction} reply`;
    });
    const f = fixture([{ id: "first" }, { id: "second" }], { complete });
    try {
      await f.dispatcher.start();
      await Promise.all(Array.from({ length: 8 }, () => f.dispatcher.dispatchQueued()));
      await vi.waitFor(() => expect(f.runs.every((run) => run.status === "completed")).toBe(true));
      expect(complete).toHaveBeenCalledTimes(2);
      expect(f.events.filter((event) => event.type === "message.created")).toHaveLength(2);
      expect(f.workspace.filter((event) => event.type === "run.updated")).toHaveLength(4);
      expect(f.runs.every((run) => run.nodeId === undefined)).toBe(true);
    } finally {
      await f.dispatcher.stop();
    }
  });

  it("never runs computer or unbound profiles through a model", async () => {
    const complete = vi.fn<ModelClient["complete"]>();
    const f = fixture(
      [
        { id: "none", executionProfile: "none" },
        { id: "browser", executionProfile: "docker-linux" },
      ],
      { complete },
    );
    await f.dispatcher.start();
    await f.dispatcher.stop();
    expect(complete).not.toHaveBeenCalled();
    expect(f.runs.every((run) => run.status === "queued")).toBe(true);
  });

  it("fails visibly when the key is missing", async () => {
    const f = fixture([{ id: "missing" }], undefined);
    await f.dispatcher.start();
    await vi.waitFor(() => expect(f.runs[0]?.status).toBe("failed"));
    await f.dispatcher.stop();
    expect(f.runs[0]?.errorMessage).toContain("模型服务");
    expect(f.replies).toHaveLength(0);
  });

  it("does not call a model when another dispatcher won the claim", async () => {
    const complete = vi.fn<ModelClient["complete"]>();
    const f = fixture([{ id: "duplicate" }], { complete });
    f.store.claimModelRun = async () => undefined;
    await f.dispatcher.start();
    await f.dispatcher.stop();
    expect(complete).not.toHaveBeenCalled();
  });

  it("caps concurrent requests and aborts them before shutdown returns", async () => {
    const seen: AbortSignal[] = [];
    const complete = vi.fn<ModelClient["complete"]>(async (_input, signal) => {
      seen.push(signal);
      return new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(new Error("stop")), { once: true }),
      );
    });
    const f = fixture([{ id: "a" }, { id: "b", botId: "second" }, { id: "c", botId: "third" }], {
      complete,
    });
    await f.dispatcher.start();
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(2));
    await f.dispatcher.stop();
    expect(seen.every((signal) => signal.aborted)).toBe(true);
    expect(f.runs.map((run) => run.status)).toEqual(["failed", "failed", "queued"]);
    expect(f.replies).toHaveLength(0);
  });

  it("sanitizes unexpected errors before persistence", async () => {
    const f = fixture([{ id: "failure" }], {
      async complete() {
        throw new Error("private upstream secret");
      },
    });
    await f.dispatcher.start();
    await vi.waitFor(() => expect(f.runs[0]?.status).toBe("failed"));
    await f.dispatcher.stop();
    expect(JSON.stringify(f.events)).not.toContain("private upstream secret");
    expect(f.replies).toHaveLength(0);
  });
});
