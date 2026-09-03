import { describe, expect, it } from "vitest";
import { nodeMessageSchema, protocolVersion, runEventSchema } from "./index.js";

describe("node protocol", () => {
  it("accepts a versioned hello message", () => {
    const result = nodeMessageSchema.safeParse({
      type: "node.hello",
      protocolVersion,
      nodeId: "node-1",
      name: "Linux worker",
      platform: "linux",
      capabilities: ["browser", "shell", "screenshot"],
      token: "development-token",
      sentAt: new Date().toISOString(),
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown capabilities", () => {
    const result = nodeMessageSchema.safeParse({
      type: "node.hello",
      protocolVersion,
      nodeId: "node-1",
      name: "Unsafe worker",
      platform: "linux",
      capabilities: ["root-access"],
      token: "development-token",
      sentAt: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });
});

describe("run events", () => {
  it("requires structured event payloads", () => {
    expect(
      runEventSchema.safeParse({
        id: "event-1",
        type: "RUN_CREATED",
        runId: "run-1",
        channelId: "channel-1",
        botId: "bot-1",
        createdAt: new Date().toISOString(),
        payload: { title: "Fill a test form" },
      }).success,
    ).toBe(true);
  });
});
