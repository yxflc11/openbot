import { platform } from "node:os";
import { coderProvider } from "@openbot/provider-coder";
import { cuaProvider } from "@openbot/provider-cua";
import { dockerProvider } from "@openbot/provider-docker";
import { lumeProvider } from "@openbot/provider-lume";
import type { ComputerProvider } from "@openbot/provider-sdk";
import type { NodeCapability } from "@openbot/protocol";

const providers: ComputerProvider[] = [dockerProvider, coderProvider, cuaProvider, lumeProvider];

export function availableProviders(): ComputerProvider[] {
  const currentPlatform = platform() === "darwin" ? "macos" : "linux";
  return providers.filter((provider) => provider.platforms.includes(currentPlatform));
}

export function availableCapabilities(): NodeCapability[] {
  return Array.from(
    new Set(availableProviders().flatMap((provider) => provider.capabilities)),
  ).sort();
}
