import type { ComputerProvider } from "@openbot/provider-sdk";

export const cuaProvider: ComputerProvider = {
  id: "cua",
  displayName: "macOS Cua driver",
  platforms: ["macos"],
  capabilities: ["cua", "screenshot"],
};
