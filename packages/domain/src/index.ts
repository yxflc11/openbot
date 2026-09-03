export type EntityId = string;

export type BotStatus =
  | "idle"
  | "running"
  | "waiting_approval"
  | "blocked"
  | "human_takeover"
  | "offline"
  | "completed"
  | "failed";

export type RunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";

export interface Channel {
  id: EntityId;
  name: string;
  description: string;
  botIds: EntityId[];
  createdAt: string;
}

export interface Bot {
  id: EntityId;
  name: string;
  role: string;
  status: BotStatus;
  computerProfile: "none" | "docker-linux" | "macos-cua" | "lume-vm" | "coder";
}

export interface ExecutionNode {
  id: EntityId;
  name: string;
  platform: "linux" | "macos" | "unknown";
  capabilities: string[];
  connectedAt: string;
  lastSeenAt: string;
}

export interface Run {
  id: EntityId;
  channelId: EntityId;
  botId: EntityId;
  nodeId?: EntityId;
  title: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BootstrapSummary {
  project: "openbot";
  phase: "foundation";
  counts: {
    channels: number;
    bots: number;
    connectedNodes: number;
    activeRuns: number;
  };
}
