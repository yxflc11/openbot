import type { Readable } from "node:stream";

export const nodeServiceControlMode = "stdio-v1" as const;
export const nodeServiceShutdownFrame = Buffer.from(
  "OPENBOT_NODE_CONTROL/1 SHUTDOWN\n",
  "ascii",
);

const maximumServiceControlBytes = 64;

/**
 * Reserve an inherited stdin pipe for one service-lifecycle command. The parent creates the pipe
 * with the exact child, so this deliberately exposes no named endpoint or general command channel.
 */
export function attachNodeServiceControl(
  input: Readable,
  requestShutdown: (exitCode: 0 | 1) => void,
): () => void {
  let received = Buffer.alloc(0);
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
    requestShutdown(exitCode);
  };
  const onData = (chunk: Buffer | string) => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (received.byteLength + bytes.byteLength > maximumServiceControlBytes) {
      settle(1);
      return;
    }
    received = Buffer.concat([received, bytes]);
    if (
      received.byteLength > nodeServiceShutdownFrame.byteLength ||
      !nodeServiceShutdownFrame.subarray(0, received.byteLength).equals(received)
    ) {
      settle(1);
      return;
    }
    if (received.byteLength === nodeServiceShutdownFrame.byteLength) settle(0);
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
