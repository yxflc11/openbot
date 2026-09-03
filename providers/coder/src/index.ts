import type { ComputerProvider } from "@openbot/provider-sdk";

export const coderProvider: ComputerProvider = {
  id: "coder",
  displayName: "Isolated coding agent",
  platforms: ["linux", "macos"],
  capabilities: ["coder", "shell"],
};
