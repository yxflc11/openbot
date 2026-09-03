import type { ComputerProvider } from "@openbot/provider-sdk";

export const dockerProvider: ComputerProvider = {
  id: "docker",
  displayName: "Docker browser and shell",
  platforms: ["linux", "macos"],
  capabilities: ["browser", "shell", "screenshot"],
};
