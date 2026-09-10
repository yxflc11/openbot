import type { Env, Hono } from "hono";
import {
  AttachmentError,
  type ChannelAttachmentStorage,
  MAX_ATTACHMENT_BYTES,
} from "./channel-attachments.js";

export interface ChannelAttachmentRouteDependencies {
  storage: ChannelAttachmentStorage;
  channelExists(channelId: string): Promise<boolean>;
}

/** Register only after the app's Owner authentication and Origin-policy middleware. */
export function registerChannelAttachmentRoutes<E extends Env>(
  app: Hono<E>,
  dependencies: ChannelAttachmentRouteDependencies,
): void {
  const prefix = "/api/v1/channels/:channelId/attachments";
  app.post(prefix, async (context) => {
    try {
      const channelId = context.req.param("channelId");
      if (!(await dependencies.channelExists(channelId)))
        return context.json({ error: "Channel not found." }, 404);
      if (context.req.header("content-type") !== "application/octet-stream")
        return context.json({ error: "Use a raw attachment body." }, 415);
      const encodedName = context.req.header("x-openbot-filename");
      if (!encodedName || encodedName.length > 2048)
        throw new AttachmentError("Missing attachment filename.");
      let name: string;
      try {
        name = decodeURIComponent(encodedName);
      } catch {
        throw new AttachmentError("Invalid attachment filename encoding.");
      }
      const bytes = await readUpload(context.req.raw);
      const attachment = await dependencies.storage.persist(channelId, name, bytes);
      return context.json({ attachment }, 201);
    } catch (error) {
      return context.json(
        { error: error instanceof AttachmentError ? error.message : "Attachment upload failed." },
        error instanceof AttachmentError ? error.status : 503,
      );
    }
  });
  app.get(`${prefix}/:attachmentId`, async (context) => {
    try {
      const channelId = context.req.param("channelId");
      if (!(await dependencies.channelExists(channelId)))
        throw new AttachmentError("Channel not found.", 404);
      return context.json({
        attachment: await dependencies.storage.metadata(
          channelId,
          context.req.param("attachmentId"),
        ),
      });
    } catch (error) {
      return context.json(
        { error: error instanceof AttachmentError ? error.message : "Attachment unavailable." },
        error instanceof AttachmentError ? error.status : 503,
      );
    }
  });
  app.get(`${prefix}/:attachmentId/content`, async (context) => {
    try {
      const channelId = context.req.param("channelId");
      if (!(await dependencies.channelExists(channelId)))
        throw new AttachmentError("Channel not found.", 404);
      const { attachment, bytes } = await dependencies.storage.read(
        channelId,
        context.req.param("attachmentId"),
      );
      // Even HTML/code and PDFs download as opaque bytes; they are never rendered in this origin.
      return new Response(bytes, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(bytes.byteLength),
          "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(attachment.name).replace(/['()*]/gu, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      return context.json(
        { error: error instanceof AttachmentError ? error.message : "Attachment unavailable." },
        error instanceof AttachmentError ? error.status : 503,
      );
    }
  });
}

async function readUpload(request: Request): Promise<Buffer> {
  const reader = request.body?.getReader();
  if (!reader) throw new AttachmentError("Missing attachment bytes.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_ATTACHMENT_BYTES) throw new AttachmentError("Attachment exceeds 10 MiB.", 413);
      chunks.push(part.value);
    }
    return Buffer.concat(chunks);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
