import { describe, expect, it, vi } from "vitest";
import { resolveAuthSession } from "./auth-session-recovery";
const loggedOut = { authenticated: false as const };
const active = {
  authenticated: true as const,
  owner: { id: "owner" as const, name: "Owner" },
  expiresAt: "2026-09-09T00:00:00Z",
};
describe("renderer local session recovery", () => {
  it("keeps remote login and existing valid sessions unchanged", async () => {
    expect(await resolveAuthSession(async () => loggedOut)).toEqual(loggedOut);
    const restore = vi.fn();
    expect(await resolveAuthSession(async () => active, restore)).toEqual(active);
    expect(restore).not.toHaveBeenCalled();
  });
  it("verifies a new Server session after one recovery", async () => {
    const read = vi.fn().mockResolvedValueOnce(loggedOut).mockResolvedValueOnce(active);
    const restore = vi.fn(async () => ({ status: "restored" as const }));
    expect(await resolveAuthSession(read, restore)).toEqual(active);
    expect(read).toHaveBeenCalledTimes(2);
    expect(restore).toHaveBeenCalledOnce();
  });
  it("does not loop or pretend authentication succeeded", async () => {
    const restore = vi.fn(async () => ({ status: "restored" as const }));
    await expect(resolveAuthSession(async () => loggedOut, restore)).rejects.toThrow("验证未完成");
    expect(restore).toHaveBeenCalledOnce();
  });
  it("ignores recovery after the caller switches connection", async () => {
    const abort = new AbortController();
    const read = vi.fn(async () => loggedOut);
    await expect(
      resolveAuthSession(
        read,
        async () => {
          abort.abort();
          return { status: "restored" };
        },
        abort.signal,
      ),
    ).rejects.toThrow();
    expect(read).toHaveBeenCalledOnce();
  });
});
