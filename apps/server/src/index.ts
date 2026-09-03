import { serve } from "@hono/node-server";
import type { Server as HttpServer } from "node:http";
import { serverEnvSchema } from "@openbot/config";
import { createApp } from "./app.js";
import { NodeRegistry } from "./node-registry.js";

const env = serverEnvSchema.parse(process.env);
const nodeRegistry = new NodeRegistry(env.OPENBOT_NODE_TOKEN);
const app = createApp({ listNodes: () => nodeRegistry.list() });

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
nodeRegistry.attach(server as HttpServer);

function shutdown(signal: string): void {
  console.info(`Received ${signal}; shutting down.`);
  server.close((error) => {
    if (error !== undefined) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
