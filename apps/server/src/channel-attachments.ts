import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TASK_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_TASK_ATTACHMENTS = 8;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;
const TEXT_EXTENSIONS = new Set(
  "txt md markdown csv tsv json jsonl yaml yml xml html css js jsx ts tsx mjs cjs py go rs java c cpp cxx h hpp swift kt kts sh bash zsh sql toml ini conf log r rb php vue svelte diff patch tex rst ipynb srt".split(
    " ",
  ),
);
const metadataSchema = z
  .object({
    id: z.string().uuid(),
    channelId: z.string().uuid(),
    name: z.string().min(1).max(160),
    mediaType: z.enum(["text/plain", "image/png", "image/jpeg", "application/pdf"]),
    sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type ChannelAttachment = z.infer<typeof metadataSchema>;
export class AttachmentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 413 | 415 | 503 = 400,
  ) {
    super(message);
  }
}
export interface ChannelAttachmentStorage {
  persist(channelId: string, name: string, bytes: Uint8Array): Promise<ChannelAttachment>;
  metadata(channelId: string, id: string): Promise<ChannelAttachment>;
  read(channelId: string, id: string): Promise<{ attachment: ChannelAttachment; bytes: Buffer }>;
}

/** Immutable private objects; only a Server-approved channel and random IDs select storage paths. */
export class FileChannelAttachmentStorage implements ChannelAttachmentStorage {
  readonly #root: string;
  #queue: Promise<unknown> = Promise.resolve();
  constructor(
    root: string,
    readonly limits = { bytes: 256 * 1024 * 1024, files: 1024 },
  ) {
    this.#root = resolve(root);
  }
  persist(channelId: string, name: string, input: Uint8Array): Promise<ChannelAttachment> {
    if (!UUID.test(channelId))
      return Promise.reject(new AttachmentError("Invalid channel identity."));
    // Snapshot caller bytes before queueing so validation, digest and disk content cannot diverge.
    const bytes = Buffer.from(input);
    const operation = this.#queue.then(async () => {
      const mediaType = validateAttachment(name, bytes);
      await mkdir(this.#root, { recursive: true, mode: 0o700 });
      const entries = await readdir(this.#root);
      const objects = entries.filter((entry) => /^[0-9a-f-]{36}\.bin$/iu.test(entry));
      if (objects.length >= this.limits.files)
        throw new AttachmentError("Attachment storage file limit reached.", 413);
      let used = 0;
      // Count orphaned bytes after a crash as well as committed objects; no silent quota bypass.
      for (const entry of objects) used += (await stat(join(this.#root, entry))).size;
      if (used + bytes.byteLength > this.limits.bytes)
        throw new AttachmentError("Attachment storage is full.", 413);
      const attachment: ChannelAttachment = {
        id: randomUUID(),
        channelId,
        name,
        mediaType,
        sizeBytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        createdAt: new Date().toISOString(),
      };
      const contentPath = this.#path(attachment.id, "bin");
      try {
        await writeFileAtomic(contentPath, bytes, { mode: 0o600 });
        // Metadata is the commit marker. Failed/incomplete writes never become readable objects.
        await writeFileAtomic(this.#path(attachment.id, "json"), JSON.stringify(attachment), {
          mode: 0o600,
        });
      } catch (error) {
        await rm(contentPath, { force: true }).catch(() => undefined);
        throw error;
      }
      return attachment;
    });
    this.#queue = operation.catch(() => undefined);
    return operation;
  }
  async metadata(channelId: string, id: string): Promise<ChannelAttachment> {
    if (!UUID.test(channelId) || !UUID.test(id))
      throw new AttachmentError("Attachment not found.", 404);
    try {
      const path = this.#path(id, "json");
      if ((await stat(path)).size > 4096) throw new Error("Oversized metadata.");
      const attachment = metadataSchema.parse(JSON.parse(await readFile(path, "utf8")));
      if (attachment.id !== id || attachment.channelId !== channelId)
        throw new Error("Wrong attachment scope.");
      return attachment;
    } catch {
      throw new AttachmentError("Attachment not found or metadata is invalid.", 404);
    }
  }
  async read(channelId: string, id: string) {
    const attachment = await this.metadata(channelId, id);
    const path = this.#path(id, "bin");
    try {
      if ((await stat(path)).size !== attachment.sizeBytes)
        throw new Error("Wrong attachment size.");
      const bytes = await readFile(path);
      if (
        bytes.byteLength !== attachment.sizeBytes ||
        createHash("sha256").update(bytes).digest("hex") !== attachment.sha256 ||
        validateAttachment(attachment.name, bytes) !== attachment.mediaType
      )
        throw new Error("Wrong attachment digest or media type.");
      return { attachment, bytes };
    } catch {
      throw new AttachmentError("Attachment bytes failed integrity validation.", 404);
    }
  }
  #path(id: string, extension: "bin" | "json") {
    if (!UUID.test(id)) throw new AttachmentError("Invalid attachment identity.");
    return join(this.#root, `${id}.${extension}`);
  }
}

export function validateAttachment(
  name: string,
  bytes: Uint8Array,
): ChannelAttachment["mediaType"] {
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._()-]{0,159}$/u.test(name))
    throw new AttachmentError("Invalid attachment filename.");
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  if (bytes.byteLength === 0) throw new AttachmentError("Empty files cannot be attached.");
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (TEXT_EXTENSIONS.has(extension)) {
    if (bytes.byteLength > 256 * 1024)
      throw new AttachmentError("Text attachment exceeds 256 KiB.", 413);
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (/\0/u.test(text)) throw new Error("Binary text.");
    } catch {
      throw new AttachmentError("Text/code attachments must contain UTF-8 text.", 415);
    }
    return "text/plain";
  }
  if (extension === "png" || extension === "jpg" || extension === "jpeg") {
    if (bytes.byteLength > 5 * 1024 * 1024)
      throw new AttachmentError("Image attachment exceeds 5 MiB.", 413);
    if (
      extension === "png" &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      return "image/png";
    if (
      extension !== "png" &&
      buffer.length >= 4 &&
      buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) &&
      buffer.subarray(-2).equals(Buffer.from([255, 217]))
    )
      return "image/jpeg";
    throw new AttachmentError("Image signature does not match its filename.", 415);
  }
  if (extension === "pdf") {
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES)
      throw new AttachmentError("PDF attachment exceeds 10 MiB.", 413);
    if (
      /^%PDF-[12]\.\d/u.test(buffer.subarray(0, 8).toString("ascii")) &&
      buffer.subarray(-1024).includes(Buffer.from("%%EOF"))
    )
      return "application/pdf";
    throw new AttachmentError("PDF signature is invalid.", 415);
  }
  throw new AttachmentError("This attachment format is not supported.", 415);
}

/** Parse only the initial task instruction; never call this on model output or attachment text. */
export function taskAttachmentIds(instruction: string): string[] {
  const ids = Array.from(
    instruction.matchAll(
      /\[OpenBot attachment: ([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\]/giu,
    ),
    (match) => match[1]?.toLowerCase() ?? "",
  );
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length > MAX_TASK_ATTACHMENTS)
    throw new AttachmentError("At most 8 attachments may be used per task.", 413);
  return unique;
}
