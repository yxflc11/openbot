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

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type ApprovalRisk = "write" | "destructive" | "privileged";
export type ApprovalDecision = "approve" | "reject";

export interface Channel {
  id: EntityId;
  name: string;
  description: string;
  botIds: EntityId[];
  createdAt: string;
}

export type BotHeadShape = "round" | "square" | "cat";
export type BotBodyShape = "classic" | "tall" | "cape" | "armor" | "storage" | "quadruped";
export type BotMobility = "feet" | "single-wheel" | "dual-wheel" | "hover" | "four-legs";
export type BotAccessory = "none" | "headphones" | "backpack" | "trench" | "arm" | "toolbox";
export type BotAccent = "green" | "yellow" | "red" | "blue";

export interface BotAppearance {
  head: BotHeadShape;
  body: BotBodyShape;
  mobility: BotMobility;
  accessory: BotAccessory;
  accent: BotAccent;
}

export interface Bot {
  id: EntityId;
  name: string;
  role: string;
  status: BotStatus;
  computerProfile: "none" | "docker-linux" | "macos-cua" | "lume-vm" | "coder";
  appearance?: BotAppearance | undefined;
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
  instruction: string;
  title: string;
  status: RunStatus;
  resultSummary?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: EntityId;
  runId: EntityId;
  channelId: EntityId;
  botId: EntityId;
  nodeId: EntityId;
  action: string;
  target: string;
  summary: string;
  risk: ApprovalRisk;
  targetFingerprint: string;
  beforeState: Record<string, unknown>;
  status: ApprovalStatus;
  expiresAt: string;
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface ApprovalResolution {
  approval: Approval;
  run: Run;
}

export interface Artifact {
  id: EntityId;
  runId: EntityId;
  name: string;
  mediaType: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
}

export interface RunProgress {
  id: EntityId;
  runId: EntityId;
  channelId: EntityId;
  nodeId: EntityId;
  stage: string;
  message: string;
  createdAt: string;
}

export interface RunFrame {
  runId: EntityId;
  channelId: EntityId;
  nodeId: EntityId;
  revision: number;
  mediaType: "image/png";
  sizeBytes: number;
  width?: number;
  height?: number;
  capturedAt: string;
}

export type MessageAuthorType = "human" | "bot" | "system";

export interface Message {
  id: EntityId;
  channelId: EntityId;
  authorType: MessageAuthorType;
  authorId?: EntityId;
  replyToMessageId?: EntityId;
  runId?: EntityId;
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
      artifacts?: Artifact[];
    }
  | {
      type: "run.progress";
      channelId: EntityId;
      progress: RunProgress;
    }
  | {
      type: "run.frame";
      channelId: EntityId;
      frame: RunFrame;
    };

export type WorkspaceRealtimeEvent =
  | {
      type: "workspace.ready";
      nodes: ExecutionNode[];
      occurredAt: string;
    }
  | {
      type: "node.upserted";
      node: ExecutionNode;
    }
  | {
      type: "node.removed";
      nodeId: EntityId;
      occurredAt: string;
    }
  | {
      type: "approval.updated";
      approval: Approval;
      run: Run;
    }
  | {
      type: "run.updated";
      run: Run;
      artifacts?: Artifact[];
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
  approvals: Approval[];
  artifacts: Artifact[];
  progress: RunProgress[];
  counts: BootstrapSummary["counts"];
}

export interface CreateBotInput {
  name: string;
  role: string;
  computerProfile: Bot["computerProfile"];
  appearance?: BotAppearance | undefined;
}

export interface CreateChannelInput {
  name: string;
  description: string;
  botIds: EntityId[];
}

export interface CreateMessageInput {
  content: string;
  botId?: EntityId | undefined;
  replyToMessageId?: EntityId | undefined;
}

export interface SubmitTaskResult {
  message: Message;
  run: Run;
}
