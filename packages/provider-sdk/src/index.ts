import type { NodeCapability } from "@openbot/protocol";

export interface ProviderContext {
  nodeId: string;
  workDirectory: string;
  signal: AbortSignal;
}

export interface PreparedAction {
  actionId: string;
  action: string;
  target: string;
  summary: string;
  risk: "read" | "write" | "destructive" | "privileged";
}

export interface ProviderResult {
  ok: boolean;
  summary: string;
  artifactPaths: string[];
}

export interface ComputerProvider {
  id: string;
  displayName: string;
  platforms: Array<"linux" | "macos">;
  capabilities: NodeCapability[];
  prepare?(context: ProviderContext, action: unknown): Promise<PreparedAction>;
  commit?(context: ProviderContext, prepared: PreparedAction): Promise<ProviderResult>;
}
