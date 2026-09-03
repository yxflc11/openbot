import { protocolVersion, type RunOffer } from "@openbot/protocol";
import { describe, expect, it } from "vitest";
import { runOfferRejectionReason } from "./client.js";

const offer: RunOffer = {
  type: "run.offer",
  protocolVersion,
  offerId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
  channelId: "00000000-0000-4000-8000-000000000003",
  botId: "00000000-0000-4000-8000-000000000004",
  title: "打开测试页并截图",
  executionProfile: "docker-linux",
  requiredCapabilities: ["browser", "screenshot"],
  sentAt: "2026-09-03T00:00:00.000Z",
};

describe("node run offers", () => {
  it("accepts only offers covered by local capabilities and capacity", () => {
    expect(runOfferRejectionReason(offer, ["browser", "screenshot"], 0, 1)).toBeUndefined();
    expect(runOfferRejectionReason(offer, ["browser"], 0, 1)).toBe(
      "Missing capabilities: screenshot.",
    );
    expect(runOfferRejectionReason(offer, ["browser", "screenshot"], 1, 1)).toBe(
      "Node is at capacity.",
    );
  });
});
