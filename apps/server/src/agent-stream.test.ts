import { describe, expect, it } from "vitest";
import { abortable, boundedEventStream } from "./agent-stream.js";
import { agentFetch } from "./native-agent.js";

describe("bounded provider streams", () => {
  it("returns an SSE response before the provider finishes and preserves distinct bytes", async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const source = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    });
    const fetcher = agentFetch(
      "openai",
      async () => new Response(source, { headers: { "content-type": "text/event-stream" } }),
    );
    const response = await fetcher("https://api.openai.com/v1/responses", { method: "POST" });
    if (!response.body) throw new Error("Missing streaming body.");
    const reader = response.body.getReader();
    controller.enqueue(new TextEncoder().encode("data: first\n\n"));
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: first\n\n");
    controller.enqueue(new TextEncoder().encode("data: second\n\n"));
    controller.close();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: second\n\n");
    expect((await reader.read()).done).toBe(true);
  });
  it("cancels a hung reader without waiting for upstream output", async () => {
    let cancelled = false;
    const upstream = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
    });
    const controller = new AbortController();
    const reader = boundedEventStream(upstream.getReader(), controller.signal).getReader();
    const read = reader.read();
    controller.abort();
    await expect(read).rejects.toThrow();
    expect(cancelled).toBe(true);
  });
  it("rejects a stream exceeding the total byte bound", async () => {
    const upstream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(512 * 1024 + 1));
      },
    });
    const reader = boundedEventStream(
      upstream.getReader(),
      new AbortController().signal,
    ).getReader();
    await expect(reader.read()).rejects.toThrow(/limits/);
  });
  it("aborts SDK promises which never settle", async () => {
    const controller = new AbortController();
    const result = abortable(new Promise(() => {}), controller.signal);
    controller.abort(new Error("stopped"));
    await expect(result).rejects.toThrow("stopped");
  });
});
