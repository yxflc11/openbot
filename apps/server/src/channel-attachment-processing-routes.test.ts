import { mkdtemp, readFile, rm } from "node:fs/promises";
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

it("returns an actionable error for an image-only PDF through upload and process routes", async () => {
  const root = await mkdtemp(join(tmpdir(), "openbot-empty-pdf-route-"));
  try {
    const storage = new FileChannelAttachmentStorage(root);
    const app = new Hono();
    registerChannelAttachmentRoutes(app, {
      storage,
      channelExists: async (id) => id === channel,
      processing: new AttachmentProcessingService({ storage }),
    });
    const bytes = await readFile(
      new URL("./__fixtures__/attachments/image-only.pdf", import.meta.url),
    );
    const url = `/api/v1/channels/${channel}/attachments`;
    const uploaded = await app.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "x-openbot-filename": "scan.pdf" },
      body: Uint8Array.from(bytes),
    });
    expect(uploaded.status).toBe(201);
    const { attachment } = await uploaded.json();
    const response = await app.request(`${url}/${attachment.id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "extract" }),
    });
    expect(response.status).toBe(415);
    expect((await response.json()).error).toContain("Upload PNG/JPEG pages");
    const current = await (await app.request(`${url}/${attachment.id}`)).json();
    expect(current.attachment.processing).toBeUndefined();
    const download = await app.request(`${url}/${attachment.id}/content`);
    expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30000);
