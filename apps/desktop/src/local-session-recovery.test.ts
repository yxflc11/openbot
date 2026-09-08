import { describe, expect, it, vi } from "vitest";
import { LocalSessionRecovery } from "./local-session-recovery.js";

const url = "http://127.0.0.1:4321";
describe("owned local identity recovery", () => {
  it("never authenticates an unbound, other, or stopped Server", async () => {
    const recovery = new LocalSessionRecovery();
    const authenticate = vi.fn();
    expect(await recovery.restore(url)).toEqual({ status: "unavailable" });
    recovery.bind(url, authenticate, () => true);
    expect(await recovery.restore("https://remote.test")).toEqual({ status: "unavailable" });
    recovery.bind(url, authenticate, () => false);
    expect(await recovery.restore(url)).toEqual({ status: "unavailable" });
    expect(authenticate).not.toHaveBeenCalled();
  });
  it("coalesces expired requests and rejects completion after ownership changes", async () => {
    const recovery = new LocalSessionRecovery();
    let finish!: () => void;
    const authenticate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    recovery.bind(url, authenticate, () => true);
    const first = recovery.restore(url);
    expect(recovery.restore(url)).toBe(first);
    await Promise.resolve();
    expect(authenticate).toHaveBeenCalledOnce();
    recovery.clear();
    finish();
    expect(await first).toEqual({ status: "unavailable" });
    const next = vi.fn(async () => {});
    recovery.bind(url, next, () => true);
    expect(await recovery.restore(url)).toEqual({ status: "restored" });
    expect(next).toHaveBeenCalledOnce();
  });
  it("does not disclose login errors and permits an explicit later retry", async () => {
    const recovery = new LocalSessionRecovery();
    const authenticate = vi
      .fn()
      .mockRejectedValueOnce(new Error("private fixture details"))
      .mockResolvedValue(undefined);
    recovery.bind(url, authenticate, () => true);
    expect(await recovery.restore(url)).toEqual({ status: "unavailable" });
    expect(await recovery.restore(url)).toEqual({ status: "restored" });
  });
});
