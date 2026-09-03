import type { ComputerProvider } from "@openbot/provider-sdk";

export const lumeProvider: ComputerProvider = {
  id: "lume",
  displayName: "Lume macOS virtual machine",
  platforms: ["macos"],
  capabilities: ["lume", "cua", "screenshot"],
};
