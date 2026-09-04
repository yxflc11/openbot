import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  attachNodeServiceControl,
  nodeServiceShutdownFrame,
} from "./service-control.js";

describe("Node service control", () => {
  it("accepts one exact fragmented shutdown frame", async () => {
    const input = new PassThrough();
    const exitCodes: number[] = [];
    attachNodeServiceControl(input, (exitCode) => exitCodes.push(exitCode));

    input.write(nodeServiceShutdownFrame.subarray(0, 8));
    input.write(nodeServiceShutdownFrame.subarray(8, 24));
    input.write(nodeServiceShutdownFrame.subarray(24));
    await tick();

    expect(exitCodes).toEqual([0]);
    expect(input.isPaused()).toBe(true);
  });

  it("fails closed on malformed, extra, or excessive input without echoing it", async () => {
    for (const value of [
      Buffer.from("STOP\n"),
      Buffer.concat([nodeServiceShutdownFrame, Buffer.from("AGAIN\n")]),
      Buffer.alloc(65, 0x61),
    ]) {
      const input = new PassThrough();
      const exitCodes: number[] = [];
      attachNodeServiceControl(input, (exitCode) => exitCodes.push(exitCode));

      input.write(value);
      await tick();

      expect(exitCodes).toEqual([1]);
      expect(input.isPaused()).toBe(true);
    }
  });

  it("fails closed when the parent pipe ends before the command", async () => {
    const input = new PassThrough();
    const exitCodes: number[] = [];
    attachNodeServiceControl(input, (exitCode) => exitCodes.push(exitCode));

    input.end(nodeServiceShutdownFrame.subarray(0, 12));
    await tick();

    expect(exitCodes).toEqual([1]);
  });

  it("can detach without creating a shutdown request", async () => {
    const input = new PassThrough();
    const exitCodes: number[] = [];
    const detach = attachNodeServiceControl(input, (exitCode) => exitCodes.push(exitCode));

    detach();
    input.end();
    await tick();

    expect(exitCodes).toEqual([]);
  });
});

function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
