import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), readFile: vi.fn() }));
vi.mock("node:util", () => ({ promisify: () => mocks.execute }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
import { startWindowsPostgres } from "./windows-postgres.js";

const record = (pid = 1234) => `${pid}\nC:\\fixture\\postgres\n100\n6543\n`;
const stopped = () => Object.assign(new Error("No server"), { code: 3 });
let command: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  vi.stubEnv("SystemRoot", "C:\\Windows");
  vi.spyOn(process, "kill").mockReturnValue(true);
  mocks.readFile.mockReset().mockResolvedValue(record());
  command = vi.fn().mockResolvedValue({});
  command.mockRejectedValueOnce(stopped());
  mocks.execute.mockReset().mockImplementation((_executable, args) => {
    const promise = command(args);
    return Object.assign(promise, { child: { stdin: { end() {} } } });
  });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Windows PostgreSQL lifecycle authority", () => {
  it("does not take over a cluster that is already running", async () => {
    command.mockReset().mockResolvedValue({});
    await expect(startWindowsPostgres("C:\\runtime", "C:\\fixture", 6543, vi.fn())).rejects.toThrow(
      "already running",
    );
    expect(command).toHaveBeenCalledTimes(1);
  });
  it("does not stop a process whose private PID identity changed", async () => {
    const process = await startWindowsPostgres("C:\\runtime", "C:\\fixture", 6543, vi.fn());
    mocks.readFile.mockResolvedValue(record(5678));
    await expect(process.stop()).rejects.toThrow("ownership changed");
    expect(command).toHaveBeenCalledTimes(2);
  });
  it("cleans up a proven partially started process after the launcher fails", async () => {
    command.mockRejectedValueOnce(new Error("Start timed out"));
    await expect(startWindowsPostgres("C:\\runtime", "C:\\fixture", 6543, vi.fn())).rejects.toThrow(
      "Start timed out",
    );
    expect(command).toHaveBeenLastCalledWith(expect.arrayContaining(["stop", "fast"]));
  });
  it("does not report an old monitor failure after an intentional stop", async () => {
    const onExit = vi.fn();
    const process = await startWindowsPostgres("C:\\runtime", "C:\\fixture", 6543, onExit);
    let rejectProbe!: (error: Error) => void;
    mocks.readFile.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectProbe = reject;
        }),
    );
    await vi.advanceTimersByTimeAsync(2000);
    await process.stop();
    rejectProbe(new Error("Old probe completed after stop"));
    await vi.advanceTimersByTimeAsync(1);
    expect(onExit).not.toHaveBeenCalled();
    expect(process.isAlive()).toBe(false);
  });
  it("reports loss of the tracked postmaster", async () => {
    const onExit = vi.fn();
    await startWindowsPostgres("C:\\runtime", "C:\\fixture", 6543, onExit);
    mocks.readFile.mockRejectedValue(new Error("PID file disappeared"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(onExit).toHaveBeenCalledOnce();
  });
});
