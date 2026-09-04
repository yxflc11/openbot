import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  attachMacOSNodeServiceControl,
  attachNodeServiceControl,
  maximumMacOSHostIdentityBytes,
  nodeMacOSServiceIdentityPrefix,
  nodeMacOSServiceShutdownFrame,
  nodeMacOSServiceStartFrame,
  nodeServiceShutdownFrame,
  nodeServiceStartFrame,
} from "./service-control.js";

const identity = {
  format: "openbot.node-identity/v1" as const,
  nodeId: "mac-node",
  credential: `obn_${"a".repeat(43)}`,
  enrolledAt: "2026-09-04T00:00:00.000Z",
};

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

describe("macOS Node Host control", () => {
  it("starts only after one exact length-delimited identity and START frame", async () => {
    const input = new PassThrough();
    const starts: (typeof identity)[] = [];
    const exitCodes: number[] = [];
    attachMacOSNodeServiceControl(input, identity.nodeId, {
      start: (value) => starts.push(value as typeof identity),
      shutdown: (exitCode) => exitCodes.push(exitCode),
    });
    const frame = macOSIdentityFrame(identity);

    input.write(frame.subarray(0, 11));
    input.write(frame.subarray(11, frame.byteLength - 5));
    await tick();
    expect(starts).toEqual([]);
    input.write(frame.subarray(frame.byteLength - 5));
    await tick();

    expect(starts).toEqual([identity]);
    expect(exitCodes).toEqual([]);
    input.write(nodeMacOSServiceShutdownFrame.subarray(0, 9));
    input.write(nodeMacOSServiceShutdownFrame.subarray(9));
    await tick();
    expect(exitCodes).toEqual([0]);
    expect(input.isPaused()).toBe(true);
  });

  it("fails closed on invalid length, identity, Node id, order, replay, or extra bytes", async () => {
    const wrongNode = { ...identity, nodeId: "other-node" };
    const malformedCases = [
      Buffer.concat([nodeMacOSServiceIdentityPrefix, Buffer.from("0\n")]),
      Buffer.concat([
        nodeMacOSServiceIdentityPrefix,
        Buffer.from(`${maximumMacOSHostIdentityBytes + 1}\n`),
      ]),
      Buffer.concat([nodeMacOSServiceIdentityPrefix, Buffer.from("01\n{")]),
      macOSIdentityFrame({ ...identity, credential: "invalid" }),
      macOSIdentityFrame(wrongNode),
      nodeMacOSServiceStartFrame,
      Buffer.concat([macOSIdentityFrame(identity), macOSIdentityFrame(identity)]),
      Buffer.concat([
        macOSIdentityFrame(identity),
        nodeMacOSServiceShutdownFrame,
        Buffer.from("x"),
      ]),
    ];

    for (const value of malformedCases) {
      const input = new PassThrough();
      const starts: unknown[] = [];
      const exitCodes: number[] = [];
      attachMacOSNodeServiceControl(input, identity.nodeId, {
        start: (parsed) => starts.push(parsed),
        shutdown: (exitCode) => exitCodes.push(exitCode),
      });
      input.write(value);
      await tick();

      expect(exitCodes).toEqual([1]);
      expect(starts.length).toBeLessThanOrEqual(1);
    }
  });

  it("fails closed on invalid UTF-8, truncation, excess input, EOF, or handler failure", async () => {
    const invalidUtf8 = Buffer.from([0xff]);
    const cases = [
      Buffer.concat([
        nodeMacOSServiceIdentityPrefix,
        Buffer.from("1\n"),
        invalidUtf8,
        nodeMacOSServiceStartFrame,
      ]),
      macOSIdentityFrame(identity).subarray(0, -1),
      Buffer.alloc(maximumMacOSHostIdentityBytes + 257, 0x61),
    ];

    for (const value of cases) {
      const input = new PassThrough();
      const exitCodes: number[] = [];
      attachMacOSNodeServiceControl(input, identity.nodeId, {
        start: () => undefined,
        shutdown: (exitCode) => exitCodes.push(exitCode),
      });
      input.end(value);
      await tick();
      expect(exitCodes).toEqual([1]);
    }

    const input = new PassThrough();
    const exitCodes: number[] = [];
    attachMacOSNodeServiceControl(input, identity.nodeId, {
      start: () => {
        throw new Error("must not escape");
      },
      shutdown: (exitCode) => exitCodes.push(exitCode),
    });
    input.write(macOSIdentityFrame(identity));
    await tick();
    expect(exitCodes).toEqual([1]);
  });

  it("can detach without starting or reporting shutdown", async () => {
    const input = new PassThrough();
    const starts: unknown[] = [];
    const exitCodes: number[] = [];
    const detach = attachMacOSNodeServiceControl(input, identity.nodeId, {
      start: (parsed) => starts.push(parsed),
      shutdown: (exitCode) => exitCodes.push(exitCode),
    });

    detach();
    input.end(macOSIdentityFrame(identity));
    await tick();
    expect(starts).toEqual([]);
    expect(exitCodes).toEqual([]);
  });
});

function macOSIdentityFrame(value: object): Buffer {
  const bytes = Buffer.from(JSON.stringify(value));
  return Buffer.concat([
    nodeMacOSServiceIdentityPrefix,
    Buffer.from(`${bytes.byteLength}\n`, "ascii"),
    bytes,
    nodeMacOSServiceStartFrame,
  ]);
}

function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
