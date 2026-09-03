import { describe, expect, it } from "vitest";
import {
  createBotInputSchema,
  createChannelInputSchema,
  nodeMessageSchema,
  protocolVersion,
  runEventSchema,
} from "./index.js";

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

describe("control plane inputs", () => {
  it("trims Bot fields and validates its computer profile", () => {
    expect(
      createBotInputSchema.parse({
        name: "  Ops  ",
        role: "  Browser operations  ",
        computerProfile: "docker-linux",
      }),
    ).toEqual({
      name: "Ops",
      role: "Browser operations",
      computerProfile: "docker-linux",
    });
  });

  it("deduplicates a channel roster", () => {
    const botId = "00000000-0000-4000-8000-000000000001";
    expect(
      createChannelInputSchema.parse({
        name: "Operations",
        description: "",
        botIds: [botId, botId],
      }).botIds,
    ).toEqual([botId]);
  });
});
