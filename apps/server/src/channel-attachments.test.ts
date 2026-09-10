import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareAttachmentContext } from "./agent-attachments.js";
import { registerChannelAttachmentRoutes } from "./channel-attachment-routes.js";
import {
  FileChannelAttachmentStorage,
  taskAttachmentIds,
  validateAttachment,
} from "./channel-attachments.js";

const channelId = "00000000-0000-4000-8000-000000000001";
const otherChannel = "00000000-0000-4000-8000-000000000002";
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fixture(limits?: { bytes: number; files: number }) {
  const root = await mkdtemp(join(tmpdir(), "openbot-attachments-"));
  directories.push(root);
  return { root, storage: new FileChannelAttachmentStorage(root, limits) };
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8ioAAAAASUVORK5CYII=",
  "base64",
);
const pdf = Buffer.from("%PDF-1.7\n1 0 obj <</Type/Catalog>> endobj\n%%EOF");

describe("persistent channel attachments", () => {
  it("preserves a larger code file across a Server storage restart", async () => {
    const { root, storage } = await fixture();
    const bytes = Buffer.from("const answer = 42;\n".repeat(10000));
    const attachment = await storage.persist(channelId, "analysis.ts", bytes);
    const restarted = new FileChannelAttachmentStorage(root);
    expect((await restarted.read(channelId, attachment.id)).bytes).toEqual(bytes);
    expect(attachment.sizeBytes).toBeGreaterThan(6000);
    expect(await readFile(join(root, `${attachment.id}.bin`))).toEqual(bytes);
    await expect(restarted.read(otherChannel, attachment.id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it.each(["digest", "size", "metadata"])("fails closed on stored %s tampering", async (mode) => {
    const { root, storage } = await fixture();
    const attachment = await storage.persist(channelId, "plan.md", Buffer.from("review"));
    if (mode === "metadata")
      await writeFile(
        join(root, `${attachment.id}.json`),
        JSON.stringify({ ...attachment, channelId: otherChannel }),
      );
    else
      await writeFile(
        join(root, `${attachment.id}.bin`),
        mode === "size" ? "longer changed" : "change",
      );
    await expect(storage.read(channelId, attachment.id)).rejects.toMatchObject({ status: 404 });
  });
  it("checks supported formats and byte boundaries rather than trusting declared MIME", () => {
    for (const name of ["a.py", "a.go", "a.tsx", "a.yaml", "a.csv", "a.sql", "a.ipynb"])
      expect(validateAttachment(name, Buffer.from("data"))).toBe("text/plain");
    expect(validateAttachment("a.png", png)).toBe("image/png");
    expect(validateAttachment("a.pdf", pdf)).toBe("application/pdf");
    expect(validateAttachment("a.jpg", Buffer.from([255, 216, 255, 1, 255, 217]))).toBe(
      "image/jpeg",
    );
    expect(validateAttachment("a.txt", Buffer.alloc(256 * 1024, 65))).toBe("text/plain");
    for (const [name, bytes] of [
      ["../a.ts", Buffer.from("text")],
      ["a.exe", Buffer.from("text")],
      ["a.txt", Buffer.from([255])],
      ["a.txt", Buffer.from("a\0b")],
      ["a.md", Buffer.alloc(0)],
      ["a.txt", Buffer.alloc(256 * 1024 + 1, 65)],
      ["a.png", Buffer.from("%PDF-1.7")],
      ["a.pdf", Buffer.from("%PDF-1.7 no end marker")],
      ["a.jpg", png],
      ["a.png", Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)])],
    ] as const)
      expect(() => validateAttachment(name, bytes)).toThrow();
  });
  it("serializes quota reservations and accounts for orphaned bytes", async () => {
    const { root, storage } = await fixture({ bytes: 10, files: 2 });
    const results = await Promise.allSettled([
      storage.persist(channelId, "one.md", Buffer.from("123456")),
      storage.persist(channelId, "two.md", Buffer.from("123456")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    await writeFile(join(root, `${otherChannel}.bin`), "orphan");
    await expect(storage.persist(channelId, "three.md", Buffer.from("1"))).rejects.toMatchObject({
      status: 413,
    });
  });
});

describe("authenticated channel attachment routes", () => {
  async function routes() {
    const { storage } = await fixture();
    const app = new Hono();
    app.use("/api/*", async (c, next) =>
      c.req.header("authorization") === "test-owner"
        ? next()
        : c.json({ error: "unauthenticated" }, 401),
    );
    registerChannelAttachmentRoutes(app, {
      storage,
      channelExists: async (id) => [channelId, otherChannel].includes(id),
    });
    return { app, storage };
  }
  it("uploads opaque bytes behind auth and downloads with no inline execution", async () => {
    const { app } = await routes();
    const endpoint = `/api/v1/channels/${channelId}/attachments`;
    expect((await app.request(endpoint, { method: "POST", body: "<b>test</b>" })).status).toBe(401);
    const response = await app.request(endpoint, {
      method: "POST",
      body: "<b>test</b>",
      headers: {
        authorization: "test-owner",
        "content-type": "application/octet-stream",
        "x-openbot-filename": "page.html",
      },
    });
    expect(response.status).toBe(201);
    const { attachment } = await response.json();
    const read = await app.request(`${endpoint}/${attachment.id}/content`, {
      headers: { authorization: "test-owner" },
    });
    expect(await read.text()).toBe("<b>test</b>");
    expect(read.headers.get("content-type")).toBe("application/octet-stream");
    expect(read.headers.get("content-disposition")).toMatch(/^attachment;/u);
    expect(
      (
        await app.request(`/api/v1/channels/${otherChannel}/attachments/${attachment.id}`, {
          headers: { authorization: "test-owner" },
        })
      ).status,
    ).toBe(404);
  });
  it("enforces actual streamed bytes even when Content-Length claims a smaller upload", async () => {
    const { app } = await routes();
    const response = await app.request(`/api/v1/channels/${channelId}/attachments`, {
      method: "POST",
      body: Buffer.alloc(10 * 1024 * 1024 + 1),
      headers: {
        authorization: "test-owner",
        "content-type": "application/octet-stream",
        "content-length": "1",
        "x-openbot-filename": "a.pdf",
      },
    });
    expect(response.status).toBe(413);
  });
});

describe("run-scoped attachment model context", () => {
  it("puts only short descriptors in the prompt and reads UTF-8/JSON-bounded pages", async () => {
    const { storage } = await fixture();
    const text = "中文\n".repeat(15000);
    const attachment = await storage.persist(channelId, "evidence.md", Buffer.from(text));
    const assertScope = vi.fn(async () => undefined);
    const prepared = await prepareAttachmentContext({
      storage,
      provider: "deepseek",
      assertScope,
      run: { channelId, instruction: `Summarize [OpenBot attachment: ${attachment.id}]` },
    });
    expect(JSON.stringify(prepared.messages)).not.toContain(text);
    const first = await prepared.readText({ attachmentId: attachment.id });
    expect(Buffer.byteLength(first.text)).toBeLessThanOrEqual(8192);
    expect(Buffer.byteLength(JSON.stringify(first))).toBeLessThan(16 * 1024);
    expect(first.truncated).toBe(true);
    if (first.nextOffset === null) throw new Error("Expected another attachment page.");
    const next = await prepared.readText({
      attachmentId: attachment.id,
      offset: first.nextOffset,
    });
    expect(first.text + next.text).toBe(text.slice(0, next.offset + next.text.length));
    await expect(prepared.readText({ attachmentId: otherChannel })).rejects.toMatchObject({
      status: 404,
    });
    expect(assertScope).toHaveBeenCalled();
  });
  it("bounds escaped control characters within the model tool output envelope", async () => {
    const { storage } = await fixture();
    const attachment = await storage.persist(
      channelId,
      "escaped.txt",
      Buffer.from("\u0001".repeat(20000)),
    );
    const prepared = await prepareAttachmentContext({
      storage,
      provider: "openai",
      assertScope: async () => undefined,
      run: { channelId, instruction: `[OpenBot attachment: ${attachment.id}]` },
    });
    expect(
      Buffer.byteLength(
        JSON.stringify(await prepared.readText({ attachmentId: attachment.id, limit: 16000 })),
      ),
    ).toBeLessThan(16 * 1024);
  });
  it("fails cross-channel references before inference and revokes reads when run scope changes", async () => {
    const { storage } = await fixture();
    const attachment = await storage.persist(otherChannel, "private.txt", Buffer.from("private"));
    const run = { channelId, instruction: `[OpenBot attachment: ${attachment.id}]` };
    await expect(
      prepareAttachmentContext({
        storage,
        provider: "openai",
        run,
        assertScope: async () => undefined,
      }),
    ).rejects.toMatchObject({ status: 404 });
    const assertScope = vi.fn(async () => undefined);
    const prepared = await prepareAttachmentContext({
      storage,
      provider: "openai",
      run: { ...run, channelId: otherChannel },
      assertScope,
    });
    assertScope.mockRejectedValue(new Error("scope revoked"));
    await expect(prepared.readText({ attachmentId: attachment.id })).rejects.toThrow(
      "scope revoked",
    );
  });
  it("builds byte-backed image and PDF model parts and rejects unsupported providers", async () => {
    const { storage } = await fixture();
    const image = await storage.persist(channelId, "image.png", png);
    const document = await storage.persist(channelId, "document.pdf", pdf);
    const run = {
      channelId,
      instruction: `[OpenBot attachment: ${image.id}] [OpenBot attachment: ${document.id}]`,
    };
    const prepared = await prepareAttachmentContext({
      storage,
      provider: "anthropic",
      run,
      assertScope: async () => undefined,
    });
    const content = prepared.messages[0]?.content as Array<Record<string, unknown>>;
    expect(content.find((part) => part.type === "image")?.image).toEqual(png);
    expect(content.find((part) => part.type === "file")?.data).toEqual(pdf);
    await expect(
      prepareAttachmentContext({
        storage,
        provider: "deepseek",
        run,
        assertScope: async () => undefined,
      }),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("limits task attachment count and parses only the explicit reference syntax", () => {
    expect(
      taskAttachmentIds(
        `[OpenBot attachment: ${channelId}] repeated [OpenBot attachment: ${channelId}]`,
      ),
    ).toEqual([channelId]);
    expect(
      taskAttachmentIds(`https://example.test/${channelId} attachmentId=${channelId}`),
    ).toEqual([]);
    expect(() =>
      taskAttachmentIds(
        Array.from(
          { length: 9 },
          (_, i) => `[OpenBot attachment: 00000000-0000-4000-8000-00000000000${i}]`,
        ).join(" "),
      ),
    ).toThrow("8 attachments");
  });
});
