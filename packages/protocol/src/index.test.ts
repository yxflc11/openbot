import { describe, expect, it } from "vitest";
import {
  createBotInputSchema,
  createChannelInputSchema,
  createMessageInputSchema,
  loginInputSchema,
  nodeMessageSchema,
  protocolVersion,
  runEventSchema,
  runOfferSchema,
  serverMessageSchema,
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
      maxConcurrentRuns: 1,
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
      maxConcurrentRuns: 1,
      token: "development-token",
      sentAt: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });

  it("validates the two-phase run assignment messages", () => {
    const offer = {
      type: "run.offer",
      protocolVersion,
      offerId: "00000000-0000-4000-8000-000000000001",
      runId: "00000000-0000-4000-8000-000000000002",
      channelId: "00000000-0000-4000-8000-000000000003",
      botId: "00000000-0000-4000-8000-000000000004",
      title: "打开测试页并截图",
      executionProfile: "docker-linux",
      requiredCapabilities: ["browser", "screenshot"],
      sentAt: new Date().toISOString(),
    };

    expect(runOfferSchema.safeParse(offer).success).toBe(true);
    expect(serverMessageSchema.safeParse(offer).success).toBe(true);
    expect(
      nodeMessageSchema.safeParse({
        type: "run.accept",
        protocolVersion,
        nodeId: "linux-node",
        offerId: offer.offerId,
        runId: offer.runId,
        acceptedAt: new Date().toISOString(),
      }).success,
    ).toBe(true);
    expect(
      runOfferSchema.safeParse({ ...offer, requiredCapabilities: ["root-access"] }).success,
    ).toBe(false);
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

  it("trims local messages and rejects empty content", () => {
    expect(createMessageInputSchema.parse({ content: "  继续检查表单  " })).toEqual({
      content: "继续检查表单",
    });
    expect(createMessageInputSchema.safeParse({ content: "   " }).success).toBe(false);
  });

  it("accepts an optional Bot assignment for a channel task", () => {
    const botId = "00000000-0000-4000-8000-000000000001";
    expect(createMessageInputSchema.parse({ content: "  执行任务  ", botId })).toEqual({
      content: "执行任务",
      botId,
    });
    expect(
      createMessageInputSchema.safeParse({ content: "执行任务", botId: "not-an-id" }).success,
    ).toBe(false);
  });

  it("bounds login input without normalizing the password", () => {
    expect(loginInputSchema.parse({ password: "  keep spaces  " })).toEqual({
      password: "  keep spaces  ",
    });
    expect(loginInputSchema.safeParse({ password: "" }).success).toBe(false);
    expect(loginInputSchema.safeParse({ password: "x".repeat(1025) }).success).toBe(false);
  });
});
