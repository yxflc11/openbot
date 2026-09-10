import type { UploadedComposerAttachment } from "./composer-context";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;

function attachmentPath(channelId: string, attachmentId: string): string {
  if (!UUID.test(attachmentId)) throw new Error("附件标识无效。");
  return `/api/v1/channels/${encodeURIComponent(channelId)}/attachments/${encodeURIComponent(attachmentId)}`;
}

async function readBounded(response: Response, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!response.ok) throw new Error("附件暂不可用或无权访问。");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("附件未返回有效内容。");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > limit) throw new Error("附件响应超过允许大小。");
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function getChannelAttachment(
  channelId: string,
  id: string,
  signal: AbortSignal,
): Promise<UploadedComposerAttachment> {
  const response = await fetch(attachmentPath(channelId, id), {
    credentials: "include",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  const { attachment: value } = JSON.parse(
    new TextDecoder().decode(await readBounded(response, 16384)),
  ) as { attachment?: UploadedComposerAttachment };
  if (
    !value ||
    value.id !== id ||
    value.channelId !== channelId ||
    typeof value.name !== "string" ||
    !/^[\p{L}\p{N}][\p{L}\p{N} ._()-]{0,159}$/u.test(value.name) ||
    !Number.isSafeInteger(value.sizeBytes) ||
    value.sizeBytes <= 0 ||
    !/^[a-f0-9]{64}$/u.test(value.sha256) ||
    !["text/plain", "image/png", "image/jpeg", "application/pdf"].includes(value.mediaType) ||
    value.sizeBytes >
      (value.mediaType === "application/pdf"
        ? 10 * 1024 * 1024
        : value.mediaType === "text/plain"
          ? 256 * 1024
          : 5 * 1024 * 1024)
  )
    throw new Error("附件信息与当前频道不匹配。");
  return value;
}

export async function getAttachmentImage(
  attachment: UploadedComposerAttachment,
  signal: AbortSignal,
): Promise<Blob> {
  if (attachment.mediaType !== "image/png" && attachment.mediaType !== "image/jpeg")
    throw new Error("此附件不支持图片预览。");
  const response = await fetch(`${attachmentPath(attachment.channelId, attachment.id)}/content`, {
    credentials: "include",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
  });
  const bytes = await readBounded(response, Math.min(attachment.sizeBytes, 5 * 1024 * 1024));
  if (bytes.length !== attachment.sizeBytes) throw new Error("附件内容长度不匹配。");
  // Only these raster formats are interpreted by the image element; never render HTML/SVG/PDF.
  const valid =
    attachment.mediaType === "image/png"
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!valid) throw new Error("图片内容格式不匹配。");
  return new Blob([bytes], { type: attachment.mediaType });
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function splitMessageAttachments(content: string): { text: string; ids: string[] } {
  const ids: string[] = [];
  // Strip only the machine-generated description immediately preceding its marker.
  const text = content
    .replace(
      /(?:^User-provided attachment: [^\n]*\r?\n)?\[OpenBot attachment: ([^\]\r\n]*)\]/gmu,
      (_match, id: string) => {
        if (UUID.test(id) && !ids.includes(id) && ids.length < 8) ids.push(id);
        return UUID.test(id) ? "" : "[附件标识无效]";
      },
    )
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  return { text, ids };
}
