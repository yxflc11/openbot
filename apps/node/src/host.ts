import { arch, platform, release } from "node:os";
import type {
  NodeArchitecture,
  NodeDeviceClass,
  NodeIsolation,
  NodePlatform,
  NodeTrustTier,
} from "@openbot/protocol";

export interface WorkerHostIdentity {
  platform: NodePlatform;
  osVersion: string;
  architecture: NodeArchitecture;
  deviceClass: NodeDeviceClass;
  isolation: NodeIsolation;
  trustTier: NodeTrustTier;
}

export function detectWorkerHost(
  source: { platform: string; architecture: string; osVersion: string } = {
    platform: platform(),
    architecture: arch(),
    osVersion: release(),
  },
): WorkerHostIdentity {
  const detectedPlatform = normalizePlatform(source.platform);
  return {
    platform: detectedPlatform,
    osVersion: source.osVersion.trim().slice(0, 160) || "unknown",
    architecture: normalizeArchitecture(source.architecture),
    deviceClass:
      detectedPlatform === "windows" || detectedPlatform === "macos" ? "desktop" : "server",
    // Enrollment authenticates this Node process, not its OS isolation or physical ownership.
    isolation: "unknown",
    trustTier: "development",
  };
}

export function normalizePlatform(value: string): NodePlatform {
  switch (value) {
    case "linux":
    case "android":
    case "freebsd":
      return value;
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "unknown";
  }
}

export function normalizeArchitecture(value: string): NodeArchitecture {
  switch (value) {
    case "x64":
    case "arm64":
    case "riscv64":
      return value;
    case "arm":
      return "armv7";
    default:
      return "unknown";
  }
}
