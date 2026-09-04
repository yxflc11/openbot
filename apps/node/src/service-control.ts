import type { Readable } from "node:stream";
import { type NodeEnrollmentResult, nodeEnrollmentResultSchema } from "@openbot/protocol";

export const nodeServiceControlMode = "stdio-v2" as const;
export const nodeServiceStartFrame = Buffer.from("OPENBOT_NODE_CONTROL/2 START\n", "ascii");
export const nodeServiceShutdownFrame = Buffer.from("OPENBOT_NODE_CONTROL/2 SHUTDOWN\n", "ascii");
export const nodeMacOSServiceIdentityPrefix = Buffer.from(
  "OPENBOT_NODE_CONTROL/3 IDENTITY ",
  "ascii",
);
export const nodeMacOSServiceStartFrame = Buffer.from("OPENBOT_NODE_CONTROL/3 START\n", "ascii");
export const nodeMacOSServiceShutdownFrame = Buffer.from(
  "OPENBOT_NODE_CONTROL/3 SHUTDOWN\n",
  "ascii",
);

const maximumServiceControlBytes = 96;
export const maximumMacOSHostIdentityBytes = 4 * 1024;
const maximumMacOSServiceControlBytes = maximumMacOSHostIdentityBytes + 256;

export interface NodeServiceControlHandlers {
  start(): void;
  shutdown(exitCode: 0 | 1): void;
}

export interface MacOSNodeServiceControlHandlers {
  start(identity: NodeEnrollmentResult): void;
  shutdown(exitCode: 0 | 1): void;
}

/**
 * Reserve an inherited stdin pipe for one service-lifecycle command. The parent creates the pipe
 * with the exact child, so this deliberately exposes no named endpoint or general command channel.
 */
export function attachNodeServiceControl(
  input: Readable,
  handlers: NodeServiceControlHandlers,
): () => void {
  let received = Buffer.alloc(0);
  let totalBytes = 0;
  let started = false;
  let settled = false;

  const detach = () => {
    input.off("data", onData);
    input.off("end", onEnd);
    input.off("error", onError);
    input.pause();
  };
  const settle = (exitCode: 0 | 1) => {
    if (settled) return;
    settled = true;
    detach();
    handlers.shutdown(exitCode);
  };
  const onData = (chunk: Buffer | string) => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bytes.byteLength;
    if (totalBytes > maximumServiceControlBytes) {
      settle(1);
      return;
    }
    received = Buffer.concat([received, bytes]);

    while (!settled) {
      const expected = started ? nodeServiceShutdownFrame : nodeServiceStartFrame;
      const prefixLength = Math.min(received.byteLength, expected.byteLength);
      if (!expected.subarray(0, prefixLength).equals(received.subarray(0, prefixLength))) {
        settle(1);
        return;
      }
      if (received.byteLength < expected.byteLength) return;

      received = received.subarray(expected.byteLength);
      if (!started) {
        started = true;
        handlers.start();
        continue;
      }

      if (received.byteLength > 0) {
        settle(1);
        return;
      }
      settle(0);
    }
  };
  const onEnd = () => settle(1);
  const onError = () => settle(1);

  input.on("data", onData);
  input.once("end", onEnd);
  input.once("error", onError);

  return () => {
    if (settled) return;
    settled = true;
    detach();
  };
}

/**
 * Accept one length-delimited Keychain identity and lifecycle commands from the native parent.
 * The child stays inert until the complete identity and START frame have both passed validation.
 */
export function attachMacOSNodeServiceControl(
  input: Readable,
  nodeId: string,
  handlers: MacOSNodeServiceControlHandlers,
): () => void {
  let received = Buffer.alloc(0);
  let totalBytes = 0;
  let identityLength: number | undefined;
  let started = false;
  let settled = false;

  const detach = () => {
    input.off("data", onData);
    input.off("end", onEnd);
    input.off("error", onError);
    input.pause();
    received.fill(0);
    received = Buffer.alloc(0);
  };
  const settle = (exitCode: 0 | 1) => {
    if (settled) return;
    settled = true;
    detach();
    handlers.shutdown(exitCode);
  };
  const fail = () => settle(1);

  const processInput = () => {
    while (!settled) {
      if (started) {
        const prefixLength = Math.min(
          received.byteLength,
          nodeMacOSServiceShutdownFrame.byteLength,
        );
        if (
          !nodeMacOSServiceShutdownFrame
            .subarray(0, prefixLength)
            .equals(received.subarray(0, prefixLength))
        ) {
          fail();
          return;
        }
        if (received.byteLength < nodeMacOSServiceShutdownFrame.byteLength) return;
        if (received.byteLength !== nodeMacOSServiceShutdownFrame.byteLength) {
          fail();
          return;
        }
        settle(0);
        return;
      }

      if (identityLength === undefined) {
        const newline = received.indexOf(0x0a);
        if (newline === -1) {
          if (received.byteLength > nodeMacOSServiceIdentityPrefix.byteLength + 4) fail();
          return;
        }
        const header = received.subarray(0, newline + 1);
        const headerText = header.toString("ascii");
        if (!Buffer.from(headerText, "ascii").equals(header)) {
          fail();
          return;
        }
        const match = /^OPENBOT_NODE_CONTROL\/3 IDENTITY ([1-9][0-9]{0,3})\n$/u.exec(headerText);
        const declaredLength = match?.[1] === undefined ? 0 : Number(match[1]);
        if (declaredLength < 1 || declaredLength > maximumMacOSHostIdentityBytes) {
          fail();
          return;
        }
        identityLength = declaredLength;
        received = received.subarray(header.byteLength);
      }

      const required = identityLength + nodeMacOSServiceStartFrame.byteLength;
      if (received.byteLength < required) {
        if (received.byteLength > identityLength) {
          const startPrefix = received.subarray(identityLength);
          if (!nodeMacOSServiceStartFrame.subarray(0, startPrefix.byteLength).equals(startPrefix)) {
            fail();
          }
        }
        return;
      }

      const identityBytes = received.subarray(0, identityLength);
      const startFrame = received.subarray(identityLength, required);
      if (!startFrame.equals(nodeMacOSServiceStartFrame)) {
        fail();
        return;
      }

      let identity: NodeEnrollmentResult;
      try {
        const source = new TextDecoder("utf-8", { fatal: true }).decode(identityBytes);
        const parsed = nodeEnrollmentResultSchema.parse(JSON.parse(source));
        if (parsed.nodeId !== nodeId) throw new Error("Wrong Node id.");
        identity = parsed;
      } catch {
        identityBytes.fill(0);
        fail();
        return;
      }

      const remainder = received.subarray(required);
      identityBytes.fill(0);
      received = remainder;
      started = true;
      try {
        handlers.start(identity);
      } catch {
        fail();
      }
    }
  };
  const onData = (chunk: Buffer | string) => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bytes.byteLength;
    if (totalBytes > maximumMacOSServiceControlBytes) {
      fail();
      return;
    }
    received = Buffer.concat([received, bytes]);
    processInput();
  };
  const onEnd = () => fail();
  const onError = () => fail();

  input.on("data", onData);
  input.once("end", onEnd);
  input.once("error", onError);

  return () => {
    if (settled) return;
    settled = true;
    detach();
  };
}
