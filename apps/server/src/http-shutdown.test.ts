import { afterEach, describe, expect, it, vi } from "vitest";
import { closeHttpServer, type HttpServerLifecycle } from "./http-shutdown.js";

describe("HTTP shutdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops accepting work and closes idle connections while active requests drain", async () => {
    const calls: string[] = [];
    let finishClose: ((error?: Error) => void) | undefined;
    const server = fakeServer({
      close(callback) {
        calls.push("close");
        finishClose = callback;
      },
      closeIdleConnections() {
        calls.push("idle");
      },
      closeAllConnections() {
        calls.push("all");
      },
    });

    const shutdown = closeHttpServer(server, 100);
    expect(calls).toEqual(["close", "idle"]);

    finishClose?.();

    await expect(shutdown).resolves.toEqual({ forced: false });
    expect(calls).toEqual(["close", "idle"]);
  });

  it("force-closes remaining HTTP connections after the grace period", async () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    let finishClose: ((error?: Error) => void) | undefined;
    const server = fakeServer({
      close(callback) {
        calls.push("close");
        finishClose = callback;
      },
      closeIdleConnections() {
        calls.push("idle");
      },
      closeAllConnections() {
        calls.push("all");
        finishClose?.();
      },
    });

    const shutdown = closeHttpServer(server, 10_000);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(shutdown).resolves.toEqual({ forced: true });
    expect(calls).toEqual(["close", "idle", "all"]);
  });

  it("surfaces close errors and rejects invalid grace periods", async () => {
    const closeError = new Error("close failed");
    const server = fakeServer({
      close(callback) {
        callback(closeError);
      },
    });

    await expect(closeHttpServer(server, 100)).rejects.toBe(closeError);
    expect(() => closeHttpServer(server, 0)).toThrow(RangeError);
  });
});

function fakeServer(overrides: Partial<HttpServerLifecycle>): HttpServerLifecycle {
  return {
    close: () => undefined,
    closeIdleConnections: () => undefined,
    closeAllConnections: () => undefined,
    ...overrides,
  };
}
