import type { Server as HttpServer } from "node:http";
import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { serverEnvSchema } from "@openbot/config";
import { createDatabase } from "@openbot/db";
import { createLogger, diagnosticFields } from "@openbot/logging";
import { createApp } from "./app.js";
import { FileArtifactStorage } from "./artifact-storage.js";
import { AutomationScheduler } from "./automations.js";
import { ChannelRealtimeHub } from "./channel-realtime-hub.js";
import { EmployeePublisherKeyring } from "./employee-publisher-keyring.js";
import { closeHttpServer } from "./http-shutdown.js";
import { ModelSettingsService } from "./model-settings.js";
import { NodeIdentityService } from "./node-identity.js";
import { NodeRegistry } from "./node-registry.js";
import { OwnerAuthService } from "./owner-auth.js";
import { PostgresAutomationStore } from "./postgres-automation-store.js";
import { PostgresNodeIdentityStore } from "./postgres-node-identity-store.js";
import { PostgresRequestThrottleStore } from "./postgres-request-throttle-store.js";
import { PostgresOwnerSessionStore } from "./postgres-session-store.js";
import { PostgresControlPlaneStore } from "./postgres-store.js";
import { RequestThrottle } from "./request-throttle.js";
import { RunDispatcher } from "./run-dispatcher.js";
import { RunFrameStore } from "./run-frame-store.js";
import { WorkspaceRealtimeHub } from "./workspace-realtime-hub.js";

const env = serverEnvSchema.parse(process.env);
const logger = createLogger({ level: env.OPENBOT_LOG_LEVEL });
const HTTP_SHUTDOWN_GRACE_MS = 10_000;
const database = createDatabase(env.OPENBOT_DATABASE_URL);
await database.migrate();
const nodeIdentity = new NodeIdentityService(new PostgresNodeIdentityStore(database.db));
const nodeRegistry = new NodeRegistry(nodeIdentity);
const realtime = new ChannelRealtimeHub();
const workspaceRealtime = new WorkspaceRealtimeHub();
const unsubscribeNodeEvents = [
  nodeRegistry.onAvailable((node) => workspaceRealtime.publish({ type: "node.upserted", node })),
  nodeRegistry.onUpdated((node) => workspaceRealtime.publish({ type: "node.upserted", node })),
  nodeRegistry.onUnavailable((node) =>
    workspaceRealtime.publish({
      type: "node.removed",
      nodeId: node.id,
      occurredAt: new Date().toISOString(),
    }),
  ),
];
const store = new PostgresControlPlaneStore(database.db);
const artifactStorage = new FileArtifactStorage(env.OPENBOT_OBJECT_STORE_PATH);
const employeePublisher =
  env.OPENBOT_EMPLOYEE_PUBLISHER_KEYRING_PATH === undefined
    ? undefined
    : await EmployeePublisherKeyring.load({
        directory: env.OPENBOT_EMPLOYEE_PUBLISHER_KEYRING_PATH,
        passphraseFile: env.OPENBOT_EMPLOYEE_PUBLISHER_PASSPHRASE_FILE as string,
      });
const runFrames = new RunFrameStore();
const dispatcher = new RunDispatcher(
  store,
  nodeRegistry,
  realtime,
  artifactStorage,
  runFrames,
  workspaceRealtime,
  undefined,
  logger,
);
await dispatcher.start();
const requestThrottle = new RequestThrottle(new PostgresRequestThrottleStore(database.db));
const auth = new OwnerAuthService(
  new PostgresOwnerSessionStore(database.db),
  {
    ownerName: env.OPENBOT_OWNER_NAME,
    ownerPassword: env.OPENBOT_OWNER_PASSWORD,
    sessionTtlMs: env.OPENBOT_SESSION_TTL_HOURS * 60 * 60 * 1000,
  },
  requestThrottle,
);
const automations = new PostgresAutomationStore(database.db);
const automationScheduler = new AutomationScheduler(
  automations,
  (result) => {
    realtime.publish({
      type: "message.created",
      channelId: result.message.channelId,
      message: result.message,
    });
    realtime.publish({ type: "run.created", channelId: result.run.channelId, run: result.run });
    dispatcher.enqueue(result.run);
  },
  () =>
    logger.error(
      "automation.poll_failed",
      "Automatic task polling failed; committed Run authority remains in PostgreSQL.",
    ),
);
const app = createApp({
  automations,
  ...(env.OPENBOT_MODEL_SETTINGS_PATH && env.OPENBOT_MODEL_ENCRYPTION_KEY
    ? {
        modelSettings: new ModelSettingsService(
          env.OPENBOT_MODEL_SETTINGS_PATH,
          env.OPENBOT_MODEL_ENCRYPTION_KEY,
        ),
      }
    : {}),
  allowedOrigins: env.OPENBOT_ALLOWED_ORIGINS,
  artifactStorage,
  auth,
  dispatchRun: (run) => dispatcher.enqueue(run),
  ...(employeePublisher === undefined ? {} : { employeePublisher }),
  disconnectNode: (nodeId) => nodeRegistry.disconnect(nodeId),
  getRemoteAddress: (context) => getConnInfo(context).remote.address,
  listNodes: () => nodeRegistry.list(),
  logger,
  nodeIdentity,
  realtime,
  requestThrottle,
  resolveApproval: (resolution) => dispatcher.resolveApproval(resolution),
  runFrames,
  secureCookies: env.OPENBOT_SECURE_COOKIES,
  store,
  trustedProxyAddress: env.OPENBOT_TRUSTED_PROXY_ADDRESS,
  workspaceRealtime,
});

const server = serve(
  {
    fetch: app.fetch,
    hostname: env.OPENBOT_HOST,
    port: env.OPENBOT_PORT,
  },
  (info) => {
    // Only a successful bind can tell the owning Desktop process to send local credentials.
    const parentPort = (
      process as NodeJS.Process & { parentPort?: { postMessage(value: unknown): void } }
    ).parentPort;
    parentPort?.postMessage({ type: "openbot-server-ready", port: info.port });
    logger.info("server.listening", "OpenBot Server is listening.", {
      address: info.address,
      port: info.port,
    });
  },
);

// `serve` uses the HTTP/1 server by default; the cast narrows its public union for upgrades.
const httpServer = server as HttpServer;
nodeRegistry.attach(httpServer);
automationScheduler.start();

let shutdownPromise: Promise<void> | undefined;

function shutdown(signal: string): Promise<void> {
  if (shutdownPromise !== undefined) return shutdownPromise;
  shutdownPromise = shutdownOnce(signal);
  return shutdownPromise;
}

async function shutdownOnce(signal: string): Promise<void> {
  logger.info("server.shutdown_started", "OpenBot Server shutdown started.", { signal });
  for (const unsubscribe of unsubscribeNodeEvents) unsubscribe();

  const httpDrain = closeHttpServer(httpServer, HTTP_SHUTDOWN_GRACE_MS);
  const automationsDrained = await automationScheduler.stop();
  if (!automationsDrained)
    logger.warn(
      "automation.shutdown_forced",
      "Automatic task polling exceeded the shutdown grace period; queued Runs recover on restart.",
    );
  const dispatcherDrain = dispatcher.stop();
  nodeRegistry.close();

  const [dispatcherResult, httpResult] = await Promise.allSettled([dispatcherDrain, httpDrain]);
  const [databaseResult] = await Promise.allSettled([database.client.end({ timeout: 5 })]);

  const errors: unknown[] = [];
  if (dispatcherResult.status === "rejected") errors.push(dispatcherResult.reason);
  if (httpResult.status === "rejected") {
    errors.push(httpResult.reason);
  } else if (httpResult.value.forced) {
    logger.warn("server.shutdown_forced", "HTTP connections exceeded the shutdown grace period.", {
      durationMs: HTTP_SHUTDOWN_GRACE_MS,
    });
  }
  if (databaseResult.status === "rejected") errors.push(databaseResult.reason);
  if (errors.length > 0) throw new AggregateError(errors, "OpenBot Server shutdown failed.");
}

function requestShutdown(signal: string): void {
  void shutdown(signal).catch((error: unknown) => {
    logger.error("server.shutdown_failed", "OpenBot Server shutdown failed.", {
      signal,
      ...diagnosticFields(error),
    });
    process.exitCode = 1;
  });
}

process.once("SIGINT", () => requestShutdown("SIGINT"));
process.once("SIGTERM", () => requestShutdown("SIGTERM"));
