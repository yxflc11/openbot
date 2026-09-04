import type { ComputerProvider } from "@openbot/provider-sdk";

export const coderProvider: ComputerProvider = {
  id: "coder",
  displayName: "Isolated coding agent",
  platforms: ["linux", "windows", "macos"],
  capabilities: ["coder", "shell"],
  capabilityManifest: [
    { id: "code.execute", version: 1, providerId: "coder", constraints: {} },
    { id: "shell.execute", version: 1, providerId: "coder", constraints: {} },
  ],
};
