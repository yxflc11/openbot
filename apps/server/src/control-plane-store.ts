import type {
  Bot,
  Channel,
  CreateBotInput,
  CreateChannelInput,
  CreateMessageInput,
  Message,
  Run,
  SubmitTaskResult,
} from "@openbot/domain";

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
  getCounts(): Promise<PersistedCounts>;
  createBot(input: CreateBotInput): Promise<Bot>;
  createChannel(input: CreateChannelInput): Promise<Channel>;
  submitTask(channelId: string, input: CreateMessageInput): Promise<SubmitTaskResult>;
  joinBotToChannel(channelId: string, botId: string): Promise<Channel>;
}

export class StoreConflictError extends Error {}
export class StoreNotFoundError extends Error {}
export class StoreValidationError extends Error {}
