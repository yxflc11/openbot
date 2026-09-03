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
  | "assigned"
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
  createdAt: string;
}

export interface ExecutionNode {
  id: EntityId;
  name: string;
  platform: "linux" | "macos" | "unknown";
  capabilities: string[];
  activeRunIds: EntityId[];
  maxConcurrentRuns: number;
  connectedAt: string;
  lastSeenAt: string;
}

export interface Run {
  id: EntityId;
  channelId: EntityId;
  botId: EntityId;
  sourceMessageId?: EntityId;
  nodeId?: EntityId;
  executionProfile: Bot["computerProfile"];
  title: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
}

export type MessageAuthorType = "human" | "bot" | "system";

export interface Message {
  id: EntityId;
  channelId: EntityId;
  authorType: MessageAuthorType;
  authorId?: EntityId;
  content: string;
  createdAt: string;
}

export interface OwnerIdentity {
  id: "owner";
  name: string;
}

export type AuthSessionSnapshot =
  | { authenticated: false }
  | {
      authenticated: true;
      owner: OwnerIdentity;
      expiresAt: string;
    };

export type ChannelRealtimeEvent =
  | {
      type: "channel.ready";
      channelId: EntityId;
      occurredAt: string;
    }
  | {
      type: "message.created";
      channelId: EntityId;
      message: Message;
    }
  | {
      type: "run.created";
      channelId: EntityId;
      run: Run;
    }
  | {
      type: "run.updated";
      channelId: EntityId;
      run: Run;
    };

export interface BootstrapSummary {
  project: "openbot";
  phase: "foundation" | "m0" | "m1";
  counts: {
    channels: number;
    bots: number;
    connectedNodes: number;
    activeRuns: number;
  };
}

export interface WorkspaceSnapshot {
  channels: Channel[];
  bots: Bot[];
  nodes: ExecutionNode[];
  runs: Run[];
  counts: BootstrapSummary["counts"];
}

export interface CreateBotInput {
  name: string;
  role: string;
  computerProfile: Bot["computerProfile"];
}

export interface CreateChannelInput {
  name: string;
  description: string;
  botIds: EntityId[];
}

export interface CreateMessageInput {
  content: string;
  botId?: EntityId | undefined;
}

export interface SubmitTaskResult {
  message: Message;
  run: Run;
}
