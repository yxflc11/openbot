import type { SubmitTaskResult } from "@openbot/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AutomationScheduler,
  createAutomationInputSchema,
  nextIntervalOccurrence,
} from "./automations.js";

describe("interval automations", () => {
  afterEach(() => vi.useRealTimers());
  it("advances exactly past downtime and preserves elapsed-time cadence across DST", () => {
    const first = new Date("2026-03-07T14:00:00Z");
    expect(nextIntervalOccurrence(first, 1440, first).toISOString()).toBe(
      "2026-03-08T14:00:00.000Z",
    );
    expect(
      nextIntervalOccurrence(first, 1440, new Date("2026-09-05T14:00:00Z")).toISOString(),
    ).toBe("2026-09-06T14:00:00.000Z");
    expect(nextIntervalOccurrence(first, 1440, new Date("2026-03-01T00:00:00Z"))).toBe(first);
    expect(() => nextIntervalOccurrence(first, 0, first)).toThrow();
    expect(() => nextIntervalOccurrence(new Date("invalid"), 60, first)).toThrow();
  });
  it("rejects authority fields and nonfinite, short, or excessive intervals", () => {
    const command = {
      name: "Check",
      prompt: "Review",
      channelId: "c",
      botId: "b",
      intervalMinutes: 60,
      firstRunAt: "2026-09-06T00:00:00Z",
    };
    expect(createAutomationInputSchema.safeParse(command).success).toBe(true);
    for (const intervalMinutes of [0, 14, 15.5, 10081, Number.NaN, Number.POSITIVE_INFINITY])
      expect(createAutomationInputSchema.safeParse({ ...command, intervalMinutes }).success).toBe(
        false,
      );
    expect(createAutomationInputSchema.safeParse({ ...command, allowUnsafe: true }).success).toBe(
      false,
    );
    expect(
      createAutomationInputSchema.safeParse({ ...command, firstRunAt: "2026-09-06T00:00" }).success,
    ).toBe(false);
  });
  it("coalesces concurrent ticks and drains the accepted transaction before stopping", async () => {
    vi.useFakeTimers();
    let resolve: (value: []) => void = () => {};
    const submitDue = vi.fn(
      () =>
        new Promise<[]>((done) => {
          resolve = done;
        }),
    );
    const publish = vi.fn();
    const onError = vi.fn();
    const scheduler = new AutomationScheduler({ submitDue }, publish, onError);
    scheduler.start();
    scheduler.start();
    const pending = scheduler.tick();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(submitDue).toHaveBeenCalledTimes(1);
    const stop = scheduler.stop();
    let stopped = false;
    void stop.then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    resolve([]);
    await pending;
    await stop;
    await vi.advanceTimersByTimeAsync(60_000);
    await scheduler.tick();
    expect(submitDue).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
  it("bounds shutdown even when the database pool never grants a connection", async () => {
    vi.useFakeTimers();
    let resolve: (value: SubmitTaskResult[]) => void = () => {};
    const submitDue = vi.fn(
      () =>
        new Promise<SubmitTaskResult[]>((done) => {
          resolve = done;
        }),
    );
    const publish = vi.fn();
    const scheduler = new AutomationScheduler({ submitDue }, publish, vi.fn());
    scheduler.start();
    const stop = scheduler.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await stop).toBe(false);
    resolve([
      {
        message: {
          id: "message",
          channelId: "channel",
          authorType: "system",
          authorId: null,
          content: "Test",
          createdAt: "2026-09-05T00:00:00Z",
        },
        run: {
          id: "run",
          channelId: "channel",
          botId: "bot",
          title: "Test",
          instruction: "Test",
          executionProfile: "none",
          status: "queued",
          createdAt: "2026-09-05T00:00:00Z",
          updatedAt: "2026-09-05T00:00:00Z",
        },
      },
    ]);
    await scheduler.tick();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(submitDue).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });
  it("reports errors without publishing a failed database transaction and resumes polling", async () => {
    vi.useFakeTimers();
    const submitDue = vi
      .fn()
      .mockRejectedValueOnce(new Error("sensitive database error"))
      .mockResolvedValue([]);
    const publish = vi.fn();
    const onError = vi.fn();
    const scheduler = new AutomationScheduler({ submitDue }, publish, onError);
    scheduler.start();
    await scheduler.tick();
    expect(onError).toHaveBeenCalledExactlyOnceWith();
    expect(publish).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(submitDue).toHaveBeenCalledTimes(2);
    await scheduler.stop();
  });
});
