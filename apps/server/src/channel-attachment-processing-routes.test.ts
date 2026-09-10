import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { expect, it, vi } from "vitest";
import { AttachmentProcessingService } from "./attachment-processing.js";
import { registerChannelAttachmentRoutes } from "./channel-attachment-routes.js";
import { FileChannelAttachmentStorage } from "./channel-attachments.js";

const channel = "00000000-0000-4000-8000-000000000001";
it("lists, tombstones and restores within channel scope and fails closed without cleanup reference checks", async () => {
  const root = await mkdtemp(join(tmpdir(), "openbot-attachment-route-"));
  try {
    const storage = new FileChannelAttachmentStorage(root);
    const attachment = await storage.persist(channel, "original.txt", Buffer.from("content"));
    const app = new Hono();
    registerChannelAttachmentRoutes(app, {
      storage,
      channelExists: async (id) => id === channel,
      processing: new AttachmentProcessingService({ storage }),
    });
    const url = `/api/v1/channels/${channel}/attachments`;
    expect((await (await app.request(url)).json()).attachments).toHaveLength(1);
    expect(
      (await (await app.request(`${url}/${attachment.id}`, { method: "DELETE" })).json()).attachment
        .deletedAt,
    ).toBeTruthy();
    expect(
      (await (await app.request(`${url}/${attachment.id}/restore`, { method: "POST" })).json())
        .attachment.deletedAt,
    ).toBeUndefined();
    expect(
      (
        await app.request(`${url}/cleanup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ olderThanDays: 7 }),
        })
      ).status,
    ).toBe(503);
    expect(
      (
        await app.request(`${url}/${attachment.id}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "extract", password: "x".repeat(5000) }),
        })
      ).status,
    ).toBe(413);
    expect(
      (
        await app.request(
          `/api/v1/channels/00000000-0000-4000-8000-000000000002/attachments/${attachment.id}`,
          { method: "DELETE" },
        )
      ).status,
    ).toBe(404);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("rejects unknown processing keys before any parser or external request", async () => {
  const process = vi.fn();
  const storage = {} as FileChannelAttachmentStorage;
  const app = new Hono();
  registerChannelAttachmentRoutes(app, {
    storage,
    channelExists: async () => true,
    processing: { process } as unknown as AttachmentProcessingService,
  });
  const response = await app.request(`/api/v1/channels/${channel}/attachments/${channel}/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation: "transcribe", endpoint: "https://attacker.example" }),
  });
  expect(response.status).toBe(400);
  expect(process).not.toHaveBeenCalled();
});
