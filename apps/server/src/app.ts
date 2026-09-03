import type { BootstrapSummary, ExecutionNode } from "@openbot/domain";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export interface AppDependencies {
  listNodes: () => ExecutionNode[];
}

export function createApp(dependencies: AppDependencies) {
  const app = new Hono();

  app.use(logger());
  app.use(
    "/api/*",
    cors({
      origin: ["http://localhost:5173"],
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  );

  app.get("/health", (context) =>
    context.json({
      ok: true,
      service: "openbot-server",
      phase: "foundation",
      time: new Date().toISOString(),
    }),
  );

  app.get("/api/v1/bootstrap", (context) => {
    const nodes = dependencies.listNodes();
    const summary: BootstrapSummary = {
      project: "openbot",
      phase: "foundation",
      counts: {
        channels: 0,
        bots: 0,
        connectedNodes: nodes.length,
        activeRuns: 0,
      },
    };
    return context.json(summary);
  });

  app.get("/api/v1/nodes", (context) => context.json({ nodes: dependencies.listNodes() }));

  return app;
}
