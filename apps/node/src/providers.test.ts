import { nodeEnvSchema } from "@openbot/config";
import { coderProvider } from "@openbot/provider-coder";
import { cuaProvider } from "@openbot/provider-cua";
import { lumeProvider } from "@openbot/provider-lume";
import { inspectProviderDeclaration } from "@openbot/provider-sdk";
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

  it("does not advertise declarations that cannot execute", () => {
    const declarations = [
      {
        id: "cua",
        displayName: "Cua declaration",
        platforms: ["macos" as const],
        capabilities: ["cua" as const, "screenshot" as const],
        capabilityManifest: [
          { id: "desktop.observe" as const, version: 1, providerId: "cua", constraints: {} },
        ],
      },
    ];

    expect(availableCapabilities(declarations)).toEqual([]);
    expect(availableCapabilityManifest(declarations)).toEqual([]);
  });

  it("keeps unfinished built-in Provider packages conformant but declaration-only", () => {
    for (const provider of [cuaProvider, lumeProvider, coderProvider]) {
      expect(inspectProviderDeclaration(provider)).toMatchObject({
        providerId: provider.id,
        conformant: true,
        executionStatus: "declaration-only",
        issues: [],
      });
    }
  });
});
