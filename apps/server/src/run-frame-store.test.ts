import { protocolVersion } from "@openbot/protocol";
import { describe, expect, it } from "vitest";
import { RunFrameStore } from "./run-frame-store.js";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe("RunFrameStore", () => {
  it("keeps only the newest bounded PNG frame for a run", () => {
    const frames = new RunFrameStore();
    const message = {
      type: "run.frame" as const,
      protocolVersion,
      nodeId: "linux-node",
      runId: "00000000-0000-4000-8000-000000000001",
      mediaType: "image/png" as const,
      base64: png.toString("base64"),
      width: 1280,
      height: 800,
      capturedAt: "2026-09-04T00:00:00.000Z",
    };

    expect(frames.publish("channel-1", message)).toMatchObject({ revision: 1, sizeBytes: 9 });
    expect(frames.publish("channel-1", { ...message, width: 1440 })).toMatchObject({
      revision: 2,
      width: 1440,
    });
    expect(frames.get(message.runId)?.bytes).toEqual(png);
    expect(frames.publish("channel-1", { ...message, base64: "bm90IGEgcG5n" })).toBeUndefined();
    expect(frames.get(message.runId)?.frame.revision).toBe(2);
  });

  it("evicts the oldest run without persisting screen data", () => {
    const frames = new RunFrameStore({ maxFrames: 1 });
    const message = {
      type: "run.frame" as const,
      protocolVersion,
      nodeId: "linux-node",
      runId: "00000000-0000-4000-8000-000000000001",
      mediaType: "image/png" as const,
      base64: png.toString("base64"),
      capturedAt: "2026-09-04T00:00:00.000Z",
    };
    frames.publish("channel-1", message);
    frames.publish("channel-2", {
      ...message,
      runId: "00000000-0000-4000-8000-000000000002",
    });

    expect(frames.get(message.runId)).toBeUndefined();
    expect(frames.get("00000000-0000-4000-8000-000000000002")).toBeDefined();
  });
});
