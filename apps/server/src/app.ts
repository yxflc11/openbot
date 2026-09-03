import type { BootstrapSummary, ExecutionNode, WorkspaceSnapshot } from "@openbot/domain";
import {
  createBotInputSchema,
  createChannelInputSchema,
  joinChannelBotInputSchema,
} from "@openbot/protocol";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { ZodType } from "zod";
import {
  StoreConflictError,
  StoreNotFoundError,
  StoreValidationError,
  type ControlPlaneStore,
} from "./control-plane-store.js";

export interface AppDependencies {
  listNodes: () => ExecutionNode[];
  store: ControlPlaneStore;
}

export function createApp(dependencies: AppDependencies) {
  const app = new Hono();

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
