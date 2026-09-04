import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  attachNodeServiceControl,
  nodeServiceStartFrame,
  nodeServiceShutdownFrame,
} from "./service-control.js";

describe("Node service control", () => {
  it("starts only after an exact fragmented frame, then accepts shutdown", async () => {
    const input = new PassThrough();
    const starts: string[] = [];
    const exitCodes: number[] = [];
    attachNodeServiceControl(input, {
      start: () => starts.push("started"),
      shutdown: (exitCode) => exitCodes.push(exitCode),
    });

    input.write(nodeServiceStartFrame.subarray(0, 8));
    input.write(nodeServiceStartFrame.subarray(8));
    await tick();
    expect(starts).toEqual(["started"]);
    expect(exitCodes).toEqual([]);

    input.write(nodeServiceShutdownFrame.subarray(0, 12));
    input.write(nodeServiceShutdownFrame.subarray(12));
    await tick();

    expect(exitCodes).toEqual([0]);
    expect(input.isPaused()).toBe(true);
  });

  it("fails closed on malformed, out-of-order, repeated, extra, or excessive input", async () => {
    for (const value of [
      Buffer.from("STOP\n"),
      nodeServiceShutdownFrame,
      Buffer.concat([nodeServiceStartFrame, nodeServiceStartFrame]),
      Buffer.concat([nodeServiceStartFrame, nodeServiceShutdownFrame, Buffer.from("AGAIN\n")]),
      Buffer.alloc(97, 0x61),
    ]) {
      const input = new PassThrough();
      const starts: string[] = [];
      const exitCodes: number[] = [];
      attachNodeServiceControl(input, {
        start: () => starts.push("started"),
        shutdown: (exitCode) => exitCodes.push(exitCode),
      });

      input.write(value);
      await tick();

      expect(exitCodes).toEqual([1]);
      expect(input.isPaused()).toBe(true);
      expect(starts.length).toBeLessThanOrEqual(1);
    }
  });

  it("fails closed when the parent pipe ends before start or shutdown", async () => {
    for (const value of [nodeServiceStartFrame.subarray(0, 12), nodeServiceStartFrame]) {
      const input = new PassThrough();
      const starts: string[] = [];
      const exitCodes: number[] = [];
      attachNodeServiceControl(input, {
        start: () => starts.push("started"),
        shutdown: (exitCode) => exitCodes.push(exitCode),
      });

      input.end(value);
      await tick();

      expect(exitCodes).toEqual([1]);
      expect(starts.length).toBe(value.byteLength === nodeServiceStartFrame.byteLength ? 1 : 0);
    }
  });

  it("can detach without creating a shutdown request", async () => {
    const input = new PassThrough();
    const starts: string[] = [];
    const exitCodes: number[] = [];
    const detach = attachNodeServiceControl(input, {
      start: () => starts.push("started"),
      shutdown: (exitCode) => exitCodes.push(exitCode),
    });

    detach();
    input.end(Buffer.concat([nodeServiceStartFrame, nodeServiceShutdownFrame]));
    await tick();

    expect(starts).toEqual([]);
    expect(exitCodes).toEqual([]);
  });
});

function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
