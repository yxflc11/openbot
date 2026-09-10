import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Run } from "@openbot/domain";
import { afterEach, expect, it, vi } from "vitest";
import { type AppDependencies, createApp } from "./app.js";
import { AttachmentError, FileChannelAttachmentStorage } from "./channel-attachments.js";
import {
  type ControlPlaneStore,
  StoreConflictError,
  StoreNotFoundError,
} from "./control-plane-store.js";
import { OwnerAuthService } from "./owner-auth.js";
import { RequestThrottle } from "./request-throttle.js";
import type { StoredOwnerSession } from "./session-store.js";

const origin = "http://localhost:5173";
const channel = "00000000-0000-4000-8000-000000000001";
const runId = "00000000-0000-4000-8000-000000000002";
const botId = "00000000-0000-4000-8000-000000000003";
const run = {
  id: runId,
  channelId: channel,
  botId,
  status: "queued",
  executionProfile: "none",
} as Run;
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture(extra: Partial<AppDependencies> = {}) {
  const sessions = new Map<string, StoredOwnerSession>();
  const throttle = new RequestThrottle({
    reserveAttempt: async () => ({ allowed: true }),
    clearAttempts: async () => {},
  });
  const auth = new OwnerAuthService(
    {
      createSession: async (input) => {
        sessions.set(input.tokenDigest, input);
        return input;
      },
      findActiveSession: async (digest, now) => {
        const value = sessions.get(digest);
        return value && value.expiresAt > now ? value : undefined;
      },
      revokeSession: async (digest) => {
        sessions.delete(digest);
      },
    },
    { ownerName: "Fixture Owner", ownerPassword: "synthetic-owner-password", sessionTtlMs: 60_000 },
    throttle,
  );
  const submitTask = vi.fn(async () => ({
    message: { id: "message", channelId: channel, content: "saved", authorType: "human" },
    run,
  }));
  const dispatchRun = vi.fn();
  const app = createApp({
    allowedOrigins: [origin],
    auth,
    requestThrottle: throttle,
    getRemoteAddress: () => "127.0.0.1",
    listNodes: () => [],
    secureCookies: false,
    store: {
      submitTask,
      channelExists: async (id: string) => id === channel,
    } as unknown as ControlPlaneStore,
    dispatchRun,
    ...extra,
  });
  const login = await app.request("/api/v1/auth/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "synthetic-owner-password" }),
  });
  expect(login.status).toBe(200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(url, {
      method: "POST",
      headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  return { app, cookie, post, submitTask, dispatchRun };
}
it("steering requires real Owner authentication, trusted Origin, valid identity and bounded text", async () => {
  const steer = vi.fn(async () => ({
    id: runId,
    runId,
    channelId: channel,
    botId,
    instruction: "Focus",
    createdAt: new Date().toISOString(),
  }));
  const value = await fixture({ steerNativeRun: steer });
  const path = `/api/v1/runs/${runId}/steer`;
  expect((await value.post(path, { instruction: "Focus" }, { Cookie: "" })).status).toBe(401);
  expect(
    (await value.post(path, { instruction: "Focus" }, { Origin: "https://attacker.example" }))
      .status,
  ).toBe(403);
  for (const body of [
    { instruction: "" },
    { instruction: "x".repeat(4001) },
    { instruction: "Focus", botId },
  ])
    expect((await value.post(path, body)).status).toBe(422);
  expect((await value.post("/api/v1/runs/invalid/steer", { instruction: "Focus" })).status).toBe(
    422,
  );
  expect((await value.post(path, { instruction: `[OpenBot attachment: ${runId}]` })).status).toBe(
    400,
  );
  expect(steer).not.toHaveBeenCalled();
  expect((await value.post(path, { instruction: "  Focus  " })).status).toBe(202);
  expect(steer).toHaveBeenCalledExactlyOnceWith(runId, "Focus");
  expect(value.dispatchRun).not.toHaveBeenCalled();
});
it("maps steering unavailability, stale-task conflict and missing task without dispatch", async () => {
  const absent = await fixture();
  expect((await absent.post(`/api/v1/runs/${runId}/steer`, { instruction: "Focus" })).status).toBe(
    503,
  );
  const steer = vi
    .fn()
    .mockRejectedValueOnce(new StoreConflictError("Task ended."))
    .mockRejectedValueOnce(new StoreNotFoundError("Task missing."));
  const value = await fixture({ steerNativeRun: steer });
  expect((await value.post(`/api/v1/runs/${runId}/steer`, { instruction: "Focus" })).status).toBe(
    409,
  );
  expect((await value.post(`/api/v1/runs/${runId}/steer`, { instruction: "Focus" })).status).toBe(
    404,
  );
  expect(value.dispatchRun).not.toHaveBeenCalled();
});
it("output snapshots authenticate, validate IDs and prevent cache storage", async () => {
  const nativeRunOutput = vi.fn(async () => ({
    runId,
    channelId: channel,
    botId,
    sequence: 1,
    text: "draft",
    reset: false,
  }));
  const value = await fixture({ nativeRunOutput });
  expect((await value.app.request(`/api/v1/runs/${runId}/output`)).status).toBe(401);
  expect(
    (await value.app.request("/api/v1/runs/invalid/output", { headers: { Cookie: value.cookie } }))
      .status,
  ).toBe(422);
  expect(nativeRunOutput).not.toHaveBeenCalled();
  const response = await value.app.request(`/api/v1/runs/${runId}/output`, {
    headers: { Cookie: value.cookie },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({ output: { sequence: 1, text: "draft" } });
  const missing = await fixture();
  expect(
    await (
      await missing.app.request(`/api/v1/runs/${runId}/output`, {
        headers: { Cookie: missing.cookie },
      })
    ).json(),
  ).toEqual({ output: null });
});
it("does not persist or dispatch attachment tasks without reference validation", async () => {
  const value = await fixture();
  const path = `/api/v1/channels/${channel}/messages`;
  const body = { content: `[OpenBot attachment: ${runId}]` };
  expect((await value.post(path, body, { Cookie: "" })).status).toBe(401);
  expect((await value.post(path, body, { Origin: "https://attacker.example" })).status).toBe(403);
  expect((await value.post(path, { content: "" })).status).toBe(422);
  expect((await value.post(path, body)).status).toBe(503);
  expect(value.submitTask).not.toHaveBeenCalled();
  expect(value.dispatchRun).not.toHaveBeenCalled();
});
it("uses the real attachment guard for deleted/cross-channel references and dispatches only retained success", async () => {
  const root = await mkdtemp(join(tmpdir(), "openbot-task-route-"));
  roots.push(root);
  const storage = new FileChannelAttachmentStorage(root);
  const attachment = await storage.persist(channel, "note.txt", Buffer.from("Synthetic note"));
  const value = await fixture({ attachments: storage });
  const path = `/api/v1/channels/${channel}/messages`;
  const body = { content: `[OpenBot attachment: ${attachment.id}]` };
  await storage.setDeleted(channel, attachment.id, true);
  expect((await value.post(path, body)).status).toBe(400);
  expect((await value.post(`/api/v1/channels/${runId}/messages`, body)).status).toBe(404);
  expect(value.submitTask).not.toHaveBeenCalled();
  expect(value.dispatchRun).not.toHaveBeenCalled();
  await storage.setDeleted(channel, attachment.id, false);
  expect((await value.post(path, body)).status).toBe(201);
  expect(value.submitTask).toHaveBeenCalledExactlyOnceWith(channel, body);
  expect(value.dispatchRun).toHaveBeenCalledExactlyOnceWith(run);
  expect(value.submitTask.mock.invocationCallOrder[0]).toBeLessThan(
    value.dispatchRun.mock.invocationCallOrder[0] ?? 0,
  );
});
it("maps guard errors without invoking persistence or dispatch", async () => {
  const root = await mkdtemp(join(tmpdir(), "openbot-task-error-"));
  roots.push(root);
  const storage = new FileChannelAttachmentStorage(root);
  vi.spyOn(storage, "withActiveReferences").mockRejectedValue(
    new AttachmentError("Task attachments exceed limit.", 413),
  );
  const value = await fixture({ attachments: storage });
  expect(
    (
      await value.post(`/api/v1/channels/${channel}/messages`, {
        content: `[OpenBot attachment: ${runId}]`,
      })
    ).status,
  ).toBe(413);
  expect(value.submitTask).not.toHaveBeenCalled();
  expect(value.dispatchRun).not.toHaveBeenCalled();
});
it("never dispatches a task whose persistence fails and does not expose internal errors", async () => {
  const value = await fixture();
  value.submitTask.mockRejectedValueOnce(new Error("synthetic-private-database-detail"));
  const response = await value.post(`/api/v1/channels/${channel}/messages`, {
    content: "Create a report",
  });
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("synthetic-private-database-detail");
  expect(value.dispatchRun).not.toHaveBeenCalled();
});
