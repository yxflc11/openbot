import type { Readable } from "node:stream";

export const nodeServiceControlMode = "stdio-v2" as const;
export const nodeServiceStartFrame = Buffer.from("OPENBOT_NODE_CONTROL/2 START\n", "ascii");
export const nodeServiceShutdownFrame = Buffer.from("OPENBOT_NODE_CONTROL/2 SHUTDOWN\n", "ascii");

const maximumServiceControlBytes = 96;

export interface NodeServiceControlHandlers {
  start(): void;
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
