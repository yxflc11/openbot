import type {
  AuthSessionSnapshot,
  Bot,
  Channel,
  ChannelRealtimeEvent,
  CreateBotInput,
  CreateChannelInput,
  CreateMessageInput,
  Message,
  Run,
  SubmitTaskResult,
  WorkspaceSnapshot,
} from "@openbot/domain";

interface ErrorPayload {
  error?: string;
  fields?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly fields: Record<string, string[]>;
  readonly status: number;

  constructor(message: string, status: number, fields: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function getAuthSession(signal?: AbortSignal): Promise<AuthSessionSnapshot> {
  return request<AuthSessionSnapshot>("/api/v1/auth/session", signal ? { signal } : undefined);
}

export async function login(
  password: string,
): Promise<AuthSessionSnapshot & { authenticated: true }> {
  const result = await request<{ session: AuthSessionSnapshot & { authenticated: true } }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    },
  );
  return result.session;
}

export async function logout(): Promise<void> {
  await request<void>("/api/v1/auth/logout", { method: "POST" });
}

export function subscribeToUnauthorized(handler: () => void): () => void {
  window.addEventListener("openbot:unauthorized", handler);
  return () => window.removeEventListener("openbot:unauthorized", handler);
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

export async function listRuns(channelId: string, signal?: AbortSignal): Promise<Run[]> {
  const result = await request<{ runs: Run[] }>(
    `/api/v1/channels/${channelId}/runs`,
    signal ? { signal } : undefined,
  );
  return result.runs;
}

export async function createMessage(
  channelId: string,
  input: CreateMessageInput,
): Promise<SubmitTaskResult> {
  return request<SubmitTaskResult>(`/api/v1/channels/${channelId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type RealtimeConnectionState = "connecting" | "live" | "retrying";

export function subscribeToChannelEvents(
  channelId: string,
  handlers: {
    onMessage(message: Message): void;
    onRun(run: Run): void;
    onReady(): void;
    onState(state: RealtimeConnectionState): void;
  },
): () => void {
  const reconnectDelayMs = 2000;
  const staleAfterMs = 35_000;
  let source: EventSource | undefined;
  let reconnectTimer: number | undefined;
  let closed = false;
  let lastActivityAt = Date.now();

  const markLive = () => {
    lastActivityAt = Date.now();
    handlers.onState("live");
  };
  const onReady = () => {
    markLive();
    handlers.onReady();
  };
  const onMessage = (event: Event) => {
    if (!(event instanceof MessageEvent) || typeof event.data !== "string") return;
    try {
      const payload: unknown = JSON.parse(event.data);
      if (isMessageCreatedEvent(payload, channelId)) {
        markLive();
        handlers.onMessage(payload.message);
      }
    } catch {
      // Ignore malformed frames and keep the stream available for the next valid event.
    }
  };
  const onRun = (event: Event) => {
    if (!(event instanceof MessageEvent) || typeof event.data !== "string") return;
    try {
      const payload: unknown = JSON.parse(event.data);
      if (isRunCreatedEvent(payload, channelId)) {
        markLive();
        handlers.onRun(payload.run);
      }
    } catch {
      // Ignore malformed frames and keep the stream available for the next valid event.
    }
  };
  const scheduleReconnect = () => {
    if (closed || reconnectTimer !== undefined) return;
    source?.close();
    source = undefined;
    handlers.onState("retrying");
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, reconnectDelayMs);
  };
  const connect = () => {
    if (closed) return;
    const nextSource = new EventSource(`/api/v1/channels/${channelId}/events`);
    source = nextSource;
    lastActivityAt = Date.now();
    nextSource.onopen = markLive;
    nextSource.onerror = () => {
      if (source === nextSource) scheduleReconnect();
    };
    nextSource.addEventListener("channel.ready", onReady);
    nextSource.addEventListener("heartbeat", markLive);
    nextSource.addEventListener("message.created", onMessage);
    nextSource.addEventListener("run.created", onRun);
  };

  handlers.onState("connecting");
  connect();
  const watchdog = window.setInterval(() => {
    if (Date.now() - lastActivityAt > staleAfterMs) scheduleReconnect();
  }, 5000);

  return () => {
    closed = true;
    source?.close();
    window.clearInterval(watchdog);
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
  };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
    if (response.status === 401 && url !== "/api/v1/auth/login") {
      window.dispatchEvent(new Event("openbot:unauthorized"));
    }
    throw new ApiError(
      payload.error ?? `OpenBot Server returned ${response.status}.`,
      response.status,
      payload.fields,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function isRunCreatedEvent(
  value: unknown,
  channelId: string,
): value is Extract<ChannelRealtimeEvent, { type: "run.created" }> {
  if (typeof value !== "object" || value === null) return false;
  if (!("type" in value) || value.type !== "run.created") return false;
  if (!("channelId" in value) || value.channelId !== channelId) return false;
  if (!("run" in value) || typeof value.run !== "object" || value.run === null) return false;
  return (
    "id" in value.run &&
    typeof value.run.id === "string" &&
    "channelId" in value.run &&
    value.run.channelId === channelId &&
    "botId" in value.run &&
    typeof value.run.botId === "string" &&
    "title" in value.run &&
    typeof value.run.title === "string" &&
    "status" in value.run &&
    typeof value.run.status === "string" &&
    "createdAt" in value.run &&
    typeof value.run.createdAt === "string" &&
    "updatedAt" in value.run &&
    typeof value.run.updatedAt === "string"
  );
}

function isMessageCreatedEvent(
  value: unknown,
  channelId: string,
): value is Extract<ChannelRealtimeEvent, { type: "message.created" }> {
  if (typeof value !== "object" || value === null) return false;
  if (!("type" in value) || value.type !== "message.created") return false;
  if (!("channelId" in value) || value.channelId !== channelId) return false;
  if (!("message" in value) || typeof value.message !== "object" || value.message === null) {
    return false;
  }
  return (
    "id" in value.message &&
    typeof value.message.id === "string" &&
    "channelId" in value.message &&
    value.message.channelId === channelId &&
    "content" in value.message &&
    typeof value.message.content === "string" &&
    "createdAt" in value.message &&
    typeof value.message.createdAt === "string"
  );
}
