import type { ComputerProvider } from "@openbot/provider-sdk";

export const lumeProvider: ComputerProvider = {
  id: "lume",
  displayName: "Lume macOS virtual machine",
  platforms: ["macos"],
  capabilities: ["lume", "cua", "screenshot"],
  capabilityManifest: [
    { id: "vm.manage", version: 1, providerId: "lume", constraints: {} },
    { id: "desktop.observe", version: 1, providerId: "lume", constraints: {} },
    { id: "screen.capture", version: 1, providerId: "lume", constraints: {} },
  ],
};
