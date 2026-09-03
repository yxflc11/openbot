import { z } from "zod";

export const protocolVersion = "0.9.0" as const;

export const nodePlatformSchema = z.enum([
  "linux",
  "windows",
  "macos",
  "android",
  "ios",
  "freebsd",
  "unknown",
]);
export type NodePlatform = z.infer<typeof nodePlatformSchema>;

export const nodeArchitectureSchema = z.enum(["x64", "arm64", "armv7", "riscv64", "unknown"]);
export type NodeArchitecture = z.infer<typeof nodeArchitectureSchema>;
