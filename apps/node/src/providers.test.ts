import { nodeEnvSchema } from "@openbot/config";
import { describe, expect, it } from "vitest";
import {
  availableCapabilities,
  availableCapabilityManifest,
  configuredProviders,
  providerForProfile,
} from "./providers.js";

const baseEnv = {
  OPENBOT_NODE_ID: "test-node",
  OPENBOT_NODE_SERVER_URL: "ws://127.0.0.1:3001/ws/nodes",
  OPENBOT_NODE_TOKEN: "test-node-token",
};

describe("configured Node providers", () => {
  it("advertises no executable capabilities without a configured computer", () => {
    const providers = configuredProviders(nodeEnvSchema.parse(baseEnv));

    expect(providers).toEqual([]);
    expect(availableCapabilities(providers)).toEqual([]);
    expect(availableCapabilityManifest(providers)).toEqual([]);
  });

  it("advertises only the configured Docker computer capabilities", () => {
    const providers = configuredProviders(
      nodeEnvSchema.parse({
        ...baseEnv,
        OPENBOT_DOCKER_COMPUTER_URL: "http://127.0.0.1:8080",
        OPENBOT_DOCKER_COMPUTER_TOKEN: "0123456789abcdef",
      }),
    );

    expect(providers.map((provider) => provider.id)).toEqual(["docker"]);
    expect(availableCapabilities(providers)).toEqual(["browser", "screenshot"]);
    expect(availableCapabilityManifest(providers).map((item) => item.id)).toEqual([
      "browser.observe",
      "screen.capture",
    ]);
    expect(providerForProfile(providers, "docker-linux")?.id).toBe("docker");
    expect(providerForProfile(providers, "macos-cua")).toBeUndefined();
  });
});
