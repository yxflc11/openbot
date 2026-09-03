import type {
  Approval,
  ApprovalDecision,
  ApprovalResolution,
  ApprovalRisk,
  Artifact,
  Bot,
  Channel,
  CreateBotInput,
  CreateChannelInput,
  CreateMessageInput,
  ExecutionNode,
  Message,
  Run,
  RunProgress,
  SubmitTaskResult,
} from "@openbot/domain";

export interface RequestApprovalInput {
  requestId: string;
  action: string;
  target: string;
  summary: string;
  risk: ApprovalRisk;
  beforeState: Record<string, unknown>;
  expiresAt: string;
}

export interface ArtifactRecord extends Artifact {
  storageKey: string;
  metadata: Record<string, unknown>;
}

export interface RunCompletion {
  run: Run;
  artifacts: Artifact[];
}

export interface PersistedCounts {
  channels: number;
  bots: number;
  activeRuns: number;
}

export interface ControlPlaneStore {
  channelExists(channelId: string): Promise<boolean>;
  listChannels(): Promise<Channel[]>;
  listBots(): Promise<Bot[]>;
  listMessages(channelId: string): Promise<Message[]>;
  listRuns(channelId?: string): Promise<Run[]>;
  listApprovals(): Promise<Approval[]>;
  listRunProgress(channelId?: string): Promise<RunProgress[]>;
  listArtifacts(runId?: string): Promise<Artifact[]>;
  getArtifact(artifactId: string): Promise<ArtifactRecord | undefined>;
  listDispatchableRuns(limit?: number): Promise<Run[]>;
  getRunningRunForNode(runId: string, nodeId: string): Promise<Run | undefined>;
  getCounts(): Promise<PersistedCounts>;
  createBot(input: CreateBotInput): Promise<Bot>;
  createChannel(input: CreateChannelInput): Promise<Channel>;
  submitTask(channelId: string, input: CreateMessageInput): Promise<SubmitTaskResult>;
  assignRun(runId: string, nodeId: string): Promise<Run | undefined>;
  startRun(runId: string, nodeId: string): Promise<Run | undefined>;
  requestApproval(
    runId: string,
    nodeId: string,
    input: RequestApprovalInput,
  ): Promise<ApprovalResolution | undefined>;
  decideApproval(
    approvalId: string,
    decision: ApprovalDecision,
    decidedBy: string,
  ): Promise<ApprovalResolution>;
  appendRunProgress(
    runId: string,
    nodeId: string,
    stage: string,
    message: string,
  ): Promise<RunProgress | undefined>;
  completeRun(
    runId: string,
    nodeId: string,
    summary: string,
    artifacts: ArtifactRecord[],
  ): Promise<RunCompletion | undefined>;
  failRun(runId: string, nodeId: string, error: string): Promise<Run | undefined>;
  failRunningRuns(nodeId?: string): Promise<Run[]>;
  requeueAssignedRuns(nodeId?: string): Promise<Run[]>;
  upsertNode(node: ExecutionNode): Promise<void>;
  markNodeOffline(nodeId: string): Promise<void>;
  joinBotToChannel(channelId: string, botId: string): Promise<Channel>;
}

export class StoreConflictError extends Error {}
export class StoreNotFoundError extends Error {}
export class StoreValidationError extends Error {}
