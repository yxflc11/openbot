import type {
  Bot,
  Channel,
  CreateBotInput,
  CreateChannelInput,
  CreateMessageInput,
  Message,
  WorkspaceSnapshot,
} from "@openbot/domain";

interface ErrorPayload {
  error?: string;
  fields?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly fields: Record<string, string[]>;

  constructor(message: string, fields: Record<string, string[]> = {}) {
    super(message);
    this.fields = fields;
  }
}

export async function getWorkspace(signal?: AbortSignal): Promise<WorkspaceSnapshot> {
  return request<WorkspaceSnapshot>("/api/v1/workspace", signal ? { signal } : undefined);
}

export async function createBot(input: CreateBotInput): Promise<Bot> {
  const result = await request<{ bot: Bot }>("/api/v1/bots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return result.bot;
}

export async function createChannel(input: CreateChannelInput): Promise<Channel> {
  const result = await request<{ channel: Channel }>("/api/v1/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return result.channel;
}

export async function joinBotToChannel(channelId: string, botId: string): Promise<Channel> {
  const result = await request<{ channel: Channel }>(`/api/v1/channels/${channelId}/bots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ botId }),
  });
  return result.channel;
}

export async function listMessages(channelId: string, signal?: AbortSignal): Promise<Message[]> {
  const result = await request<{ messages: Message[] }>(
    `/api/v1/channels/${channelId}/messages`,
    signal ? { signal } : undefined,
  );
  return result.messages;
}

export async function createMessage(
  channelId: string,
  input: CreateMessageInput,
): Promise<Message> {
  const result = await request<{ message: Message }>(`/api/v1/channels/${channelId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return result.message;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
    throw new ApiError(
      payload.error ?? `OpenBot Server returned ${response.status}.`,
      payload.fields,
    );
  }
  return (await response.json()) as T;
}
