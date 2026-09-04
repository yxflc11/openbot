import type { ComputerProvider } from "@openbot/provider-sdk";

export const cuaProvider: ComputerProvider = {
  id: "cua",
  displayName: "macOS Cua driver",
  platforms: ["macos"],
  capabilities: ["cua", "screenshot"],
  capabilityManifest: [
    { id: "desktop.observe", version: 1, providerId: "cua", constraints: {} },
    { id: "screen.capture", version: 1, providerId: "cua", constraints: {} },
  ],
};
