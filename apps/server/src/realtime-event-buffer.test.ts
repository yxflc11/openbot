import { describe, expect, it } from "vitest";
import { RealtimeEventBuffer } from "./realtime-event-buffer.js";

describe("RealtimeEventBuffer", () => {
  it("preserves event order within its fixed capacity", () => {
    const buffer = new RealtimeEventBuffer<string>(2);

    expect(buffer.enqueue("first")).toBe(true);
    expect(buffer.enqueue("second")).toBe(true);
    expect(buffer.dequeue()).toBe("first");
    expect(buffer.dequeue()).toBe("second");
    expect(buffer.empty).toBe(true);
    expect(buffer.overflowed).toBe(false);
  });

  it("fails closed and releases queued events after overflow", () => {
    const buffer = new RealtimeEventBuffer<string>(1);

    expect(buffer.enqueue("first")).toBe(true);
    expect(buffer.enqueue("overflow")).toBe(false);
    expect(buffer.overflowed).toBe(true);
    expect(buffer.empty).toBe(true);
    expect(buffer.dequeue()).toBeUndefined();
    expect(buffer.enqueue("late")).toBe(false);
  });

  it("rejects invalid capacities", () => {
    expect(() => new RealtimeEventBuffer(0)).toThrow(/positive safe integer/);
    expect(() => new RealtimeEventBuffer(Number.POSITIVE_INFINITY)).toThrow(
      /positive safe integer/,
    );
  });
});
