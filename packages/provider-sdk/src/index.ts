import type { NodeCapability } from "@openbot/protocol";

export interface ProviderContext {
  nodeId: string;
  workDirectory: string;
  signal: AbortSignal;
}

export interface ProviderRunInput {
  runId: string;
  channelId: string;
  botId: string;
  title: string;
  instruction: string;
  executionProfile: "docker-linux" | "macos-cua" | "lume-vm" | "coder";
}

export interface ProviderArtifact {
  name: string;
  mediaType: "image/png";
  base64: string;
  metadata?: Record<string, unknown>;
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
  artifacts: ProviderArtifact[];
}

export interface ProviderProgress {
  stage: string;
  message: string;
}

export interface ComputerProvider {
  id: string;
  displayName: string;
  platforms: Array<"linux" | "macos">;
  capabilities: NodeCapability[];
  execute?(
    context: ProviderContext,
    input: ProviderRunInput,
    report: (progress: ProviderProgress) => void,
  ): Promise<ProviderResult>;
  prepare?(context: ProviderContext, action: unknown): Promise<PreparedAction>;
  commit?(context: ProviderContext, prepared: PreparedAction): Promise<ProviderResult>;
}
