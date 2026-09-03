import type {
  BootstrapSummary,
  ChannelRealtimeEvent,
  ExecutionNode,
  WorkspaceSnapshot,
} from "@openbot/domain";
import {
  createBotInputSchema,
  createChannelInputSchema,
  createMessageInputSchema,
  joinChannelBotInputSchema,
} from "@openbot/protocol";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamSSE } from "hono/streaming";
import type { ZodType } from "zod";
import { ChannelRealtimeHub } from "./channel-realtime-hub.js";
import {
  StoreConflictError,
  StoreNotFoundError,
  StoreValidationError,
  type ControlPlaneStore,
} from "./control-plane-store.js";

export interface AppDependencies {
  listNodes: () => ExecutionNode[];
  realtime?: ChannelRealtimeHub;
  store: ControlPlaneStore;
}

export function createApp(dependencies: AppDependencies) {
  const app = new Hono();
  const realtime = dependencies.realtime ?? new ChannelRealtimeHub();

  app.use(logger());
  app.use(
    "/api/*",
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.get("/health", (context) =>
    context.json({
      ok: true,
      service: "openbot-server",
      phase: "m0",
      time: new Date().toISOString(),
    }),
  );

  app.get("/api/v1/bootstrap", async (context) => {
    const nodes = dependencies.listNodes();
    const persistedCounts = await dependencies.store.getCounts();
    const summary: BootstrapSummary = {
      project: "openbot",
      phase: "m0",
      counts: {
        ...persistedCounts,
        connectedNodes: nodes.length,
      },
    };
    return context.json(summary);
  });

  app.get("/api/v1/workspace", async (context) => {
    const nodes = dependencies.listNodes();
    const [channels, bots, persistedCounts] = await Promise.all([
      dependencies.store.listChannels(),
      dependencies.store.listBots(),
      dependencies.store.getCounts(),
    ]);
    const workspace: WorkspaceSnapshot = {
      channels,
      bots,
      nodes,
      counts: {
        ...persistedCounts,
        connectedNodes: nodes.length,
      },
    };
    return context.json(workspace);
  });

  app.get("/api/v1/channels", async (context) =>
    context.json({ channels: await dependencies.store.listChannels() }),
  );

  app.post("/api/v1/channels", async (context) => {
    const input = await parseRequest(context.req.raw, createChannelInputSchema);
    const channel = await dependencies.store.createChannel(input);
    return context.json({ channel }, 201);
  });

  app.post("/api/v1/channels/:channelId/bots", async (context) => {
    const input = await parseRequest(context.req.raw, joinChannelBotInputSchema);
    const channel = await dependencies.store.joinBotToChannel(
      context.req.param("channelId"),
      input.botId,
    );
    return context.json({ channel });
  });

  app.get("/api/v1/channels/:channelId/messages", async (context) =>
    context.json({
      messages: await dependencies.store.listMessages(context.req.param("channelId")),
    }),
  );

  app.get("/api/v1/channels/:channelId/events", async (context) => {
    const channelId = context.req.param("channelId");
    if (!(await dependencies.store.channelExists(channelId))) {
      throw new StoreNotFoundError("Channel not found.");
    }

    return streamSSE(context, async (stream) => {
      const queued: ChannelRealtimeEvent[] = [];
      let wake: (() => void) | undefined;
      let closed = false;
      const unsubscribe = realtime.subscribe(channelId, (event) => {
        queued.push(event);
        wake?.();
        wake = undefined;
      });
      stream.onAbort(() => {
        closed = true;
        wake?.();
        wake = undefined;
        unsubscribe();
      });

      await stream.writeSSE({
        event: "channel.ready",
        retry: 2000,
        data: JSON.stringify({
          type: "channel.ready",
          channelId,
          occurredAt: new Date().toISOString(),
        } satisfies ChannelRealtimeEvent),
      });

      try {
        while (!closed && !stream.aborted) {
          if (queued.length === 0) {
            const timedOut = await waitForEventOrTimeout((resume) => {
              wake = resume;
            });
            wake = undefined;
            if (timedOut && !closed && !stream.aborted) {
              await stream.writeSSE({ event: "heartbeat", data: new Date().toISOString() });
            }
          }

          let event = queued.shift();
          while (event !== undefined && !closed && !stream.aborted) {
            await stream.writeSSE({
              event: event.type,
              ...(event.type === "message.created" ? { id: event.message.id } : {}),
              data: JSON.stringify(event),
            });
            event = queued.shift();
          }
        }
      } finally {
        unsubscribe();
      }
    });
  });

  app.post("/api/v1/channels/:channelId/messages", async (context) => {
    const input = await parseRequest(context.req.raw, createMessageInputSchema);
    const message = await dependencies.store.createMessage(context.req.param("channelId"), input);
    realtime.publish({ type: "message.created", channelId: message.channelId, message });
    return context.json({ message }, 201);
  });

  app.get("/api/v1/bots", async (context) =>
    context.json({ bots: await dependencies.store.listBots() }),
  );

  app.post("/api/v1/bots", async (context) => {
    const input = await parseRequest(context.req.raw, createBotInputSchema);
    const bot = await dependencies.store.createBot(input);
    return context.json({ bot }, 201);
  });

  app.get("/api/v1/nodes", (context) => context.json({ nodes: dependencies.listNodes() }));

  app.onError((error, context) => {
    if (error instanceof StoreConflictError) {
      return context.json({ error: error.message }, 409);
    }
    if (error instanceof StoreNotFoundError) {
      return context.json({ error: error.message }, 404);
    }
    if (error instanceof StoreValidationError) {
      return context.json({ error: error.message }, 422);
    }
    if (error instanceof RequestValidationError) {
      return context.json({ error: error.message, fields: error.fields }, 422);
    }
    console.error(error);
    return context.json({ error: "OpenBot Server could not complete the request." }, 500);
  });

  return app;
}

const channelHeartbeatMs = 15_000;

function waitForEventOrTimeout(setWake: (wake: () => void) => void): Promise<boolean> {
  return new Promise((resolve) => {
    let completed = false;
    const timer = setTimeout(() => {
      completed = true;
      resolve(true);
    }, channelHeartbeatMs);
    setWake(() => {
      if (completed) return;
      clearTimeout(timer);
      completed = true;
      resolve(false);
    });
  });
}

class RequestValidationError extends Error {
  readonly fields: Record<string, string[]>;

  constructor(message: string, fields: Record<string, string[]>) {
    super(message);
    this.fields = fields;
  }
}

async function parseRequest<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new RequestValidationError("Request body must be valid JSON.", {});
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new RequestValidationError(
      "Please correct the highlighted fields.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }
  return parsed.data;
}
