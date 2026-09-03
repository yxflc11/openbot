import { serve } from "@hono/node-server";
import type { Server as HttpServer } from "node:http";
import { serverEnvSchema } from "@openbot/config";
import { createDatabase } from "@openbot/db";
import { createApp } from "./app.js";
import { NodeRegistry } from "./node-registry.js";
import { OwnerAuthService } from "./owner-auth.js";
import { PostgresControlPlaneStore } from "./postgres-store.js";
import { PostgresOwnerSessionStore } from "./postgres-session-store.js";

const env = serverEnvSchema.parse(process.env);
const database = createDatabase(env.OPENBOT_DATABASE_URL);
await database.migrate();
const nodeRegistry = new NodeRegistry(env.OPENBOT_NODE_TOKEN);
const auth = new OwnerAuthService(new PostgresOwnerSessionStore(database.db), {
  ownerName: env.OPENBOT_OWNER_NAME,
  ownerPassword: env.OPENBOT_OWNER_PASSWORD,
  sessionTtlMs: env.OPENBOT_SESSION_TTL_HOURS * 60 * 60 * 1000,
});
const app = createApp({
  allowedOrigins: env.OPENBOT_ALLOWED_ORIGINS,
  auth,
  listNodes: () => nodeRegistry.list(),
  secureCookies: env.OPENBOT_SECURE_COOKIES,
  store: new PostgresControlPlaneStore(database.db),
});

const server = serve(
  {
    fetch: app.fetch,
    hostname: env.OPENBOT_HOST,
    port: env.OPENBOT_PORT,
  },
  (info) => {
    console.info(`OpenBot Server listening on http://${info.address}:${info.port}`);
  },
);

// `serve` uses the HTTP/1 server by default; the cast narrows its public union for upgrades.
const httpServer = server as HttpServer;
nodeRegistry.attach(httpServer);

function shutdown(signal: string): void {
  console.info(`Received ${signal}; shutting down.`);
  nodeRegistry.close();
  httpServer.close(async (error) => {
    await database.close();
    if (error !== undefined) {
      console.error(error);
      process.exitCode = 1;
    }
  });
  httpServer.closeAllConnections();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
