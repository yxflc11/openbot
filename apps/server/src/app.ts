import type {
  ApprovalResolution,
  BootstrapSummary,
  ChannelRealtimeEvent,
  ExecutionNode,
  NodeIdentitySummary,
  Run,
  WorkspaceRealtimeEvent,
  WorkspaceSnapshot,
} from "@openbot/domain";
import {
  approvalDecisionInputSchema,
  createBotInputSchema,
  createChannelInputSchema,
  createEmployeeSkillInputSchema,
  createMessageInputSchema,
  createNodeEnrollmentTokenInputSchema,
  exchangeNodeEnrollmentInputSchema,
  joinChannelBotInputSchema,
  loginInputSchema,
  unsignedEmployeeTemplatePackageSchema,
  updateEmployeeSkillStateInputSchema,
} from "@openbot/protocol";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { streamSSE } from "hono/streaming";
import type { ZodType } from "zod";
import type { ArtifactStorage } from "./artifact-storage.js";
import { ChannelRealtimeHub } from "./channel-realtime-hub.js";
import {
  type ControlPlaneStore,
  StoreConflictError,
  StoreNotFoundError,
  StoreValidationError,
} from "./control-plane-store.js";
import {
  buildEmployeeTemplate,
  inspectEmployeeTemplate,
  serializeEmployeeTemplate,
} from "./employee-package.js";
import {
  InvalidNodeEnrollmentError,
  NodeIdentityNotFoundError,
  type NodeIdentityService,
} from "./node-identity.js";
import {
  InvalidCredentialsError,
  LoginRateLimitedError,
  type OwnerAuthService,
} from "./owner-auth.js";
import { RealtimeEventBuffer } from "./realtime-event-buffer.js";
import type { RunFrameStore } from "./run-frame-store.js";
import { WorkspaceRealtimeHub } from "./workspace-realtime-hub.js";

export interface AppDependencies {
  allowedOrigins: string[];
  artifactStorage?: Pick<ArtifactStorage, "read">;
  auth: OwnerAuthService;
  dispatchRun?: (run: Run) => void;
  listNodes: () => ExecutionNode[];
  nodeIdentity?: Pick<NodeIdentityService, "enroll" | "issueEnrollmentToken" | "list" | "revoke">;
  disconnectNode?: (nodeId: string) => boolean;
  realtime?: ChannelRealtimeHub;
  resolveApproval?: (resolution: ApprovalResolution) => void | Promise<void>;
  runFrames?: Pick<RunFrameStore, "get">;
  secureCookies: boolean;
  store: ControlPlaneStore;
  workspaceRealtime?: WorkspaceRealtimeHub;
}

export const ownerSessionCookie = "openbot_session";
export const secureOwnerSessionCookie = "__Host-openbot_session";

const maximumPendingRealtimeEvents = 128;

export function createApp(dependencies: AppDependencies) {
  const app = new Hono();
  const realtime = dependencies.realtime ?? new ChannelRealtimeHub();
  const workspaceRealtime = dependencies.workspaceRealtime ?? new WorkspaceRealtimeHub();
  const sessionCookie = dependencies.secureCookies ? secureOwnerSessionCookie : ownerSessionCookie;

  app.use(logger());
  app.use(
    secureHeaders({
      crossOriginResourcePolicy: "same-site",
      permissionsPolicy: {
        camera: [],
        geolocation: [],
        microphone: [],
        payment: [],
        usb: [],
      },
      strictTransportSecurity: dependencies.secureCookies,
      xFrameOptions: "DENY",
    }),
  );
  app.use(
    "/api/*",
    cors({
      origin: dependencies.allowedOrigins,
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      credentials: true,
    }),
  );
  app.use(
    "/api/v1/nodes/enroll",
    bodyLimit({
      maxSize: maximumNodeIdentityRequestBytes,
      onError: (context) => context.json({ error: "Node enrollment request is too large." }, 413),
    }),
  );

  app.use("/api/v1/*", async (context, next) => {
    context.header("Cache-Control", "no-store");
    if (isPublicNodeEnrollmentRoute(context.req.path)) return next();
    if (isMutation(context.req.method) && !isTrustedOrigin(context.req.header("origin"))) {
      return context.json({ error: "Request origin is not allowed." }, 403);
    }
    if (isPublicAuthRoute(context.req.path)) return next();

    const session = await dependencies.auth.authenticate(getCookie(context, sessionCookie));
    if (!session.authenticated) return context.json({ error: "Authentication required." }, 401);
    return next();
  });

  app.get("/health", (context) =>
    context.json({
      ok: true,
      service: "openbot-server",
      phase: "m1",
      time: new Date().toISOString(),
    }),
  );

  app.get("/api/v1/auth/session", async (context) => {
    const session = await dependencies.auth.authenticate(getCookie(context, sessionCookie));
    return context.json(session);
  });

  app.post("/api/v1/auth/login", async (context) => {
    const input = await parseRequest(context.req.raw, loginInputSchema);
    const result = await dependencies.auth.login(
      input.password,
      context.req.header("origin") ?? "unknown",
    );
    const maxAge = Math.max(
      1,
      Math.floor((new Date(result.session.expiresAt).getTime() - Date.now()) / 1000),
    );
    setCookie(context, sessionCookie, result.token, {
      httpOnly: true,
      maxAge,
      path: "/",
      sameSite: "Strict",
      secure: dependencies.secureCookies,
    });
    return context.json({ session: result.session });
  });

  app.post("/api/v1/auth/logout", async (context) => {
    await dependencies.auth.logout(getCookie(context, sessionCookie));
    deleteCookie(context, sessionCookie, {
      path: "/",
      sameSite: "Strict",
      secure: dependencies.secureCookies,
    });
    return context.body(null, 204);
  });

  app.post("/api/v1/nodes/enroll", async (context) => {
    const identity = requireNodeIdentity(dependencies.nodeIdentity);
    const input = await parseRequest(
      context.req.raw,
      exchangeNodeEnrollmentInputSchema,
      maximumNodeIdentityRequestBytes,
    );
    const result = await identity.enroll(input);
    // Re-enrollment rotates the durable credential. Terminate any session that authenticated with
    // the previous value so it cannot remain live until its next reconnect.
    dependencies.disconnectNode?.(result.nodeId);
    return context.json(result, 201);
  });

  app.get("/api/v1/bootstrap", async (context) => {
    const nodes = dependencies.listNodes();
    const persistedCounts = await dependencies.store.getCounts();
    const summary: BootstrapSummary = {
      project: "openbot",
      phase: "m1",
      counts: {
        ...persistedCounts,
        connectedNodes: nodes.length,
      },
    };
    return context.json(summary);
  });

  app.get("/api/v1/workspace", async (context) => {
    const nodes = dependencies.listNodes();
    const [channels, bots, runs, approvals, artifacts, progress, persistedCounts] =
      await Promise.all([
        dependencies.store.listChannels(),
        dependencies.store.listBots(),
        dependencies.store.listRuns(),
        dependencies.store.listApprovals(),
        dependencies.store.listArtifacts(),
        dependencies.store.listRunProgress(),
        dependencies.store.getCounts(),
      ]);
    const workspace: WorkspaceSnapshot = {
      channels,
      bots,
      nodes,
      runs,
      approvals,
      artifacts,
      progress,
      counts: {
        ...persistedCounts,
        connectedNodes: nodes.length,
      },
    };
    return context.json(workspace);
  });

  app.get("/api/v1/workspace/events", (context) =>
    streamSSE(context, async (stream) => {
      const queued = new RealtimeEventBuffer<WorkspaceRealtimeEvent>(maximumPendingRealtimeEvents);
      let wake: (() => void) | undefined;
      let closed = false;
      const unsubscribe = workspaceRealtime.subscribe((event) => {
        if (!queued.enqueue(event)) {
          closed = true;
          stream.abort();
        }
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
        event: "workspace.ready",
        retry: 2000,
        data: JSON.stringify({
          type: "workspace.ready",
          nodes: dependencies.listNodes(),
          occurredAt: new Date().toISOString(),
        } satisfies WorkspaceRealtimeEvent),
      });

      try {
        while (!closed && !stream.aborted) {
          if (queued.empty) {
            const timedOut = await waitForEventOrTimeout((resume) => {
              wake = resume;
            });
            wake = undefined;
            if (timedOut && !closed && !stream.aborted) {
              await stream.writeSSE({ event: "heartbeat", data: new Date().toISOString() });
            }
          }

          let event = queued.dequeue();
          while (event !== undefined && !closed && !stream.aborted) {
            await stream.writeSSE({
              event: event.type,
              ...(event.type === "workspace.ready"
                ? {}
                : {
                    id:
                      event.type === "node.upserted"
                        ? event.node.id
                        : event.type === "node.removed"
                          ? event.nodeId
                          : event.type === "approval.updated"
                            ? event.approval.id
                            : event.run.id,
                  }),
              data: JSON.stringify(event),
            });
            event = queued.dequeue();
          }
        }
      } finally {
        unsubscribe();
      }
    }),
  );

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

  app.get("/api/v1/channels/:channelId/runs", async (context) =>
    context.json({ runs: await dependencies.store.listRuns(context.req.param("channelId")) }),
  );

  app.post("/api/v1/approvals/:approvalId/decision", async (context) => {
    const input = await parseRequest(context.req.raw, approvalDecisionInputSchema);
    const resolution = await dependencies.store.decideApproval(
      context.req.param("approvalId"),
      input.decision,
      "owner",
    );
    realtime.publish({
      type: "run.updated",
      channelId: resolution.run.channelId,
      run: resolution.run,
    });
    workspaceRealtime.publish({ type: "approval.updated", ...resolution });
    await dependencies.resolveApproval?.(resolution);
    if (resolution.approval.status === "expired") {
      return context.json({ error: "Approval expired before it was decided." }, 409);
    }
    return context.json(resolution);
  });

  app.get("/api/v1/artifacts/:artifactId/content", async (context) => {
    const record = await dependencies.store.getArtifact(context.req.param("artifactId"));
    if (record === undefined) throw new StoreNotFoundError("Artifact not found.");
    if (dependencies.artifactStorage === undefined) {
      throw new Error("Artifact storage is not configured.");
    }
    const bytes = await dependencies.artifactStorage.read(record.storageKey);
    return new Response(bytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Length": String(bytes.byteLength),
        "Content-Type": record.mediaType,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });

  app.get("/api/v1/runs/:runId/frame", (context) => {
    const stored = dependencies.runFrames?.get(context.req.param("runId"));
    if (stored === undefined) throw new StoreNotFoundError("Live frame not found.");
    return new Response(stored.bytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Length": String(stored.bytes.byteLength),
        "Content-Type": stored.frame.mediaType,
        ETag: `"run-frame-${stored.frame.revision}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });

  app.get("/api/v1/channels/:channelId/events", async (context) => {
    const channelId = context.req.param("channelId");
    if (!(await dependencies.store.channelExists(channelId))) {
      throw new StoreNotFoundError("Channel not found.");
    }

    return streamSSE(context, async (stream) => {
      const queued = new RealtimeEventBuffer<ChannelRealtimeEvent>(maximumPendingRealtimeEvents);
      let wake: (() => void) | undefined;
      let closed = false;
      const unsubscribe = realtime.subscribe(channelId, (event) => {
        if (!queued.enqueue(event)) {
          closed = true;
          stream.abort();
        }
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
          if (queued.empty) {
            const timedOut = await waitForEventOrTimeout((resume) => {
              wake = resume;
            });
            wake = undefined;
            if (timedOut && !closed && !stream.aborted) {
              await stream.writeSSE({ event: "heartbeat", data: new Date().toISOString() });
            }
          }

          let event = queued.dequeue();
          while (event !== undefined && !closed && !stream.aborted) {
            await stream.writeSSE({
              event: event.type,
              ...(event.type === "message.created"
                ? { id: event.message.id }
                : event.type === "run.created" || event.type === "run.updated"
                  ? { id: event.run.id }
                  : event.type === "run.progress"
                    ? { id: event.progress.id }
                    : event.type === "run.frame"
                      ? { id: `${event.frame.runId}:${event.frame.revision}` }
                      : {}),
              data: JSON.stringify(event),
            });
            event = queued.dequeue();
          }
        }
      } finally {
        unsubscribe();
      }
    });
  });

  app.post("/api/v1/channels/:channelId/messages", async (context) => {
    const input = await parseRequest(context.req.raw, createMessageInputSchema);
    const result = await dependencies.store.submitTask(context.req.param("channelId"), input);
    realtime.publish({
      type: "message.created",
      channelId: result.message.channelId,
      message: result.message,
    });
    realtime.publish({
      type: "run.created",
      channelId: result.run.channelId,
      run: result.run,
    });
    dependencies.dispatchRun?.(result.run);
    return context.json(result, 201);
  });

  app.get("/api/v1/bots", async (context) =>
    context.json({ bots: await dependencies.store.listBots() }),
  );

  app.get("/api/v1/bots/:botId/profile", async (context) =>
    context.json({
      profile: await dependencies.store.getEmployeeProfile(context.req.param("botId")),
    }),
  );

  app.post("/api/v1/bots/:botId/skills", async (context) => {
    const input = await parseRequest(context.req.raw, createEmployeeSkillInputSchema);
    const result = await dependencies.store.createEmployeeSkill(context.req.param("botId"), input);
    return context.json(result, 201);
  });

  app.post("/api/v1/bots/:botId/skills/:skillId/state", async (context) => {
    const input = await parseRequest(context.req.raw, updateEmployeeSkillStateInputSchema);
    const result = await dependencies.store.updateEmployeeSkillState(
      context.req.param("botId"),
      context.req.param("skillId"),
      input,
    );
    return context.json(result);
  });

  app.get("/api/v1/bots/:botId/export/preview", async (context) => {
    const profile = await dependencies.store.getEmployeeProfile(context.req.param("botId"));
    return context.json({ preview: buildEmployeeTemplate(profile).preview });
  });

  app.get("/api/v1/bots/:botId/export", async (context) => {
    const profile = await dependencies.store.getEmployeeProfile(context.req.param("botId"));
    const employeeTemplate = buildEmployeeTemplate(profile);
    if (employeeTemplate.preview.blocked) {
      throw new StoreValidationError(
        "Employee template export is blocked until sensitive-looking content is removed.",
      );
    }
    context.header(
      "Content-Disposition",
      `attachment; filename="${employeeTemplate.preview.fileName}"`,
    );
    context.header("Content-Type", "application/vnd.openbot.employee+json; charset=utf-8");
    context.header("X-Content-Type-Options", "nosniff");
    return context.body(serializeEmployeeTemplate(employeeTemplate.document));
  });

  app.post("/api/v1/employees/import/preview", async (context) => {
    const employeePackage = await parseEmployeePackageRequest(context.req.raw);
    return context.json({
      preview: inspectEmployeeTemplate(employeePackage, dependencies.listNodes()),
    });
  });

  app.post("/api/v1/bots", async (context) => {
    const input = await parseRequest(context.req.raw, createBotInputSchema);
    const bot = await dependencies.store.createBot(input);
    return context.json({ bot }, 201);
  });

  app.get("/api/v1/nodes", (context) => context.json({ nodes: dependencies.listNodes() }));

  app.get("/api/v1/node-identities", async (context) => {
    const connectedById = new Map(dependencies.listNodes().map((node) => [node.id, node]));
    const identities: NodeIdentitySummary[] = (
      await requireNodeIdentity(dependencies.nodeIdentity).list()
    ).map((identity) => {
      const node = connectedById.get(identity.nodeId);
      return {
        nodeId: identity.nodeId,
        status: identity.revokedAt === null ? "active" : "revoked",
        connected: node !== undefined,
        enrolledAt: identity.enrolledAt.toISOString(),
        ...(identity.lastAuthenticatedAt === null
          ? {}
          : { lastAuthenticatedAt: identity.lastAuthenticatedAt.toISOString() }),
        ...(identity.revokedAt === null ? {} : { revokedAt: identity.revokedAt.toISOString() }),
        ...(node === undefined ? {} : { node }),
      };
    });
    return context.json({ identities });
  });

  app.post("/api/v1/nodes/enrollment-tokens", async (context) => {
    const identity = requireNodeIdentity(dependencies.nodeIdentity);
    const input = await parseRequest(
      context.req.raw,
      createNodeEnrollmentTokenInputSchema,
      maximumNodeIdentityRequestBytes,
    );
    return context.json(await identity.issueEnrollmentToken(input), 201);
  });

  app.post("/api/v1/nodes/:nodeId/revoke", async (context) => {
    const nodeId = context.req.param("nodeId");
    const parsedNodeId = createNodeEnrollmentTokenInputSchema.shape.nodeId.safeParse(nodeId);
    if (!parsedNodeId.success) {
      throw new RequestValidationError("Node id is invalid.", { nodeId: ["Invalid Node id."] });
    }
    await requireNodeIdentity(dependencies.nodeIdentity).revoke(parsedNodeId.data);
    dependencies.disconnectNode?.(parsedNodeId.data);
    return context.body(null, 204);
  });

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
    if (error instanceof InvalidCredentialsError) {
      return context.json({ error: "Password is incorrect." }, 401);
    }
    if (error instanceof LoginRateLimitedError) {
      context.header("Retry-After", String(error.retryAfterSeconds));
      return context.json({ error: error.message }, 429);
    }
    if (error instanceof InvalidNodeEnrollmentError) {
      return context.json({ error: "Node enrollment token is invalid or expired." }, 401);
    }
    if (error instanceof NodeIdentityNotFoundError) {
      return context.json({ error: error.message }, 404);
    }
    console.error(error);
    return context.json({ error: "OpenBot Server could not complete the request." }, 500);
  });

  return app;

  function isTrustedOrigin(origin: string | undefined): boolean {
    return origin !== undefined && dependencies.allowedOrigins.includes(origin);
  }
}

const channelHeartbeatMs = 15_000;

function isMutation(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function isPublicAuthRoute(path: string): boolean {
  return path === "/api/v1/auth/session" || path === "/api/v1/auth/login";
}

function isPublicNodeEnrollmentRoute(path: string): boolean {
  return path === "/api/v1/nodes/enroll";
}

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

const maximumApiRequestBytes = 64 * 1024;
const maximumNodeIdentityRequestBytes = 8 * 1024;

async function parseRequest<T>(
  request: Request,
  schema: ZodType<T>,
  maximumBytes = maximumApiRequestBytes,
): Promise<T> {
  const declaredSize = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > maximumBytes) {
    throw new RequestValidationError(`Request body must not exceed ${maximumBytes} bytes.`, {});
  }

  let body: unknown;
  try {
    const source = await request.text();
    if (new TextEncoder().encode(source).byteLength > maximumBytes) {
      throw new RequestValidationError(`Request body must not exceed ${maximumBytes} bytes.`, {});
    }
    body = JSON.parse(source);
  } catch (error) {
    if (error instanceof RequestValidationError) throw error;
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

function requireNodeIdentity(
  identity: AppDependencies["nodeIdentity"],
): NonNullable<AppDependencies["nodeIdentity"]> {
  if (identity === undefined) throw new Error("Node identity is not configured.");
  return identity;
}

const maxEmployeePackageBytes = 1024 * 1024;

async function parseEmployeePackageRequest(request: Request) {
  const declaredSize = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > maxEmployeePackageBytes) {
    throw new RequestValidationError("Employee package must not exceed 1 MiB.", {});
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxEmployeePackageBytes) {
    throw new RequestValidationError("Employee package must not exceed 1 MiB.", {});
  }

  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new RequestValidationError("Employee package must be valid JSON.", {});
  }
  const parsed = unsignedEmployeeTemplatePackageSchema.safeParse(value);
  if (!parsed.success) {
    const fields = Object.fromEntries(
      parsed.error.issues.map((issue) => [issue.path.join(".") || "package", [issue.message]]),
    );
    throw new RequestValidationError("Employee package does not match a supported format.", fields);
  }
  return parsed.data;
}
