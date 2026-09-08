import type { Server as HttpServer } from "node:http";
import { serve } from "@hono/node-server";
import { serverEnvSchema } from "@openbot/config";
import { createDatabase } from "@openbot/db";
import { createApp } from "./app.js";
import { FileArtifactStorage } from "./artifact-storage.js";
import { ChannelRealtimeHub } from "./channel-realtime-hub.js";
import { EmployeePublisherKeyring } from "./employee-publisher-keyring.js";
import { closeHttpServer } from "./http-shutdown.js";
import { NodeIdentityService } from "./node-identity.js";
import { NodeRegistry } from "./node-registry.js";
import { OwnerAuthService } from "./owner-auth.js";
import { PostgresNodeIdentityStore } from "./postgres-node-identity-store.js";
import { PostgresOwnerSessionStore } from "./postgres-session-store.js";
import { PostgresControlPlaneStore } from "./postgres-store.js";
import { RunDispatcher } from "./run-dispatcher.js";
import { RunFrameStore } from "./run-frame-store.js";
import { WorkspaceRealtimeHub } from "./workspace-realtime-hub.js";
import { ModelServices } from "./model-services.js";
import { ModelCredentialCipher } from "./model-credential-cipher.js";
import { PostgresModelConnectionStore } from "./postgres-model-connection-store.js";
import { ModelRunDispatcher } from "./model-run-dispatcher.js";
import { BrowserSessions } from "./browser-sessions.js";

const env = serverEnvSchema.parse(process.env);
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
const modelCipher = await ModelCredentialCipher.load(env.OPENBOT_MODEL_CREDENTIAL_KEY_PATH, {
  allowCreate: !(await PostgresModelConnectionStore.hasAny(database.db)),
});
const modelServices = new ModelServices(env, new PostgresModelConnectionStore(database.db, modelCipher));
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
);
await dispatcher.start();
// Recovery above settles interrupted Runs before either scheduler starts new model work.
const modelDispatcher = new ModelRunDispatcher(
  store,
  (run) => modelServices.resolve(run),
  realtime,
  workspaceRealtime,
  env.OPENBOT_MODEL_MAX_CONCURRENT_RUNS,
);
await modelDispatcher.start();
const auth = new OwnerAuthService(new PostgresOwnerSessionStore(database.db), {
  ownerName: env.OPENBOT_OWNER_NAME,
  ownerPassword: env.OPENBOT_OWNER_PASSWORD,
  sessionTtlMs: env.OPENBOT_SESSION_TTL_HOURS * 60 * 60 * 1000,
});
const browserSessions = new BrowserSessions(store, nodeRegistry, () => {
  void dispatcher.dispatchQueued().catch(() => console.error("Browser release could not wake the task queue."));
});
const app = createApp({
  modelServices,
  browserSessions,
  allowedOrigins: env.OPENBOT_ALLOWED_ORIGINS,
  artifactStorage,
  auth,
  dispatchRun: (run) => {
    if (run.executionProfile === "model") modelDispatcher.enqueue(run);
    else dispatcher.enqueue(run);
  },
  ...(employeePublisher === undefined ? {} : { employeePublisher }),
  disconnectNode: (nodeId) => nodeRegistry.disconnect(nodeId),
  listNodes: () => nodeRegistry.list(),
  nodeIdentity,
  realtime,
  resolveApproval: (resolution) => dispatcher.resolveApproval(resolution),
  runFrames,
  secureCookies: env.OPENBOT_SECURE_COOKIES,
  store,
  workspaceRealtime,
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

let shutdownPromise: Promise<void> | undefined;

function shutdown(signal: string): Promise<void> {
  if (shutdownPromise !== undefined) return shutdownPromise;
  shutdownPromise = shutdownOnce(signal);
  return shutdownPromise;
}

async function shutdownOnce(signal: string): Promise<void> {
  console.info(`Received ${signal}; shutting down.`);
  for (const unsubscribe of unsubscribeNodeEvents) unsubscribe();
  browserSessions.stop();

  const httpDrain = closeHttpServer(httpServer, HTTP_SHUTDOWN_GRACE_MS);
  const dispatcherDrain = dispatcher.stop();
  const modelDrain = modelDispatcher.stop();
  nodeRegistry.close();

  const [dispatcherResult, httpResult, modelResult] = await Promise.allSettled([
    dispatcherDrain,
    httpDrain,
    modelDrain,
  ]);
  const [databaseResult] = await Promise.allSettled([database.close()]);

  const errors: unknown[] = [];
  if (dispatcherResult.status === "rejected") errors.push(dispatcherResult.reason);
  if (modelResult.status === "rejected") errors.push(modelResult.reason);
  if (httpResult.status === "rejected") {
    errors.push(httpResult.reason);
  } else if (httpResult.value.forced) {
    console.warn(
      `HTTP connections exceeded the ${HTTP_SHUTDOWN_GRACE_MS}ms shutdown grace period and were closed.`,
    );
  }
  if (databaseResult.status === "rejected") errors.push(databaseResult.reason);
  if (errors.length > 0) throw new AggregateError(errors, "OpenBot Server shutdown failed.");
}

function requestShutdown(signal: string): void {
  void shutdown(signal).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

process.once("SIGINT", () => requestShutdown("SIGINT"));
process.once("SIGTERM", () => requestShutdown("SIGTERM"));
