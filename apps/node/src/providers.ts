import { platform } from "node:os";
import type { NodeEnv } from "@openbot/config";
import { createDockerProvider } from "@openbot/provider-docker";
import type { ComputerProvider } from "@openbot/provider-sdk";
import type { NodeCapability } from "@openbot/protocol";

export function configuredProviders(env: NodeEnv): ComputerProvider[] {
  const providers: ComputerProvider[] = [];
  if (
    env.OPENBOT_DOCKER_COMPUTER_URL !== undefined &&
    env.OPENBOT_DOCKER_COMPUTER_TOKEN !== undefined
  ) {
    providers.push(
      createDockerProvider({
        computerUrl: env.OPENBOT_DOCKER_COMPUTER_URL,
        computerToken: env.OPENBOT_DOCKER_COMPUTER_TOKEN,
        allowPrivateHosts: env.OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS,
      }),
    );
  }
  const currentPlatform = platform() === "darwin" ? "macos" : "linux";
  return providers.filter((provider) => provider.platforms.includes(currentPlatform));
}

export function availableCapabilities(providers: ComputerProvider[]): NodeCapability[] {
  return Array.from(new Set(providers.flatMap((provider) => provider.capabilities))).sort();
}

export function providerForProfile(
  providers: ComputerProvider[],
  profile: "docker-linux" | "macos-cua" | "lume-vm" | "coder",
): ComputerProvider | undefined {
  const providerIds = {
    "docker-linux": "docker",
    "macos-cua": "cua",
    "lume-vm": "lume",
    coder: "coder",
  } as const;
  const providerId = providerIds[profile];
  return providers.find((provider) => provider.id === providerId && provider.execute !== undefined);
}
