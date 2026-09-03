import type {
  Bot,
  Channel,
  CreateBotInput,
  CreateChannelInput,
  CreateMessageInput,
  Message,
} from "@openbot/domain";

export interface PersistedCounts {
  channels: number;
  bots: number;
  activeRuns: number;
}

export interface ControlPlaneStore {
  listChannels(): Promise<Channel[]>;
  listBots(): Promise<Bot[]>;
  listMessages(channelId: string): Promise<Message[]>;
  getCounts(): Promise<PersistedCounts>;
  createBot(input: CreateBotInput): Promise<Bot>;
  createChannel(input: CreateChannelInput): Promise<Channel>;
  createMessage(channelId: string, input: CreateMessageInput): Promise<Message>;
  joinBotToChannel(channelId: string, botId: string): Promise<Channel>;
}

export class StoreConflictError extends Error {}
export class StoreNotFoundError extends Error {}
export class StoreValidationError extends Error {}
