import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";

export const modelSettingsInputSchema = z
  .object({
    provider: z.enum(["openai", "anthropic"]),
    model: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u),
    apiKey: z
      .string()
      .min(16)
      .max(512)
      .regex(/^[\x21-\x7e]+$/u),
    revision: z.string().uuid().nullable(),
    agentEnabled: z.boolean().default(false),
  })
  .strict();
type ModelInput = z.infer<typeof modelSettingsInputSchema>;
const retainedSchema = modelSettingsInputSchema.extend({
  revision: z.string().uuid(),
  agentEnabledAt: z.string().datetime().nullable().default(null),
});
export type AgentModelSettings = z.infer<typeof retainedSchema>;
export type ModelSettingsSummary =
  | { status: "unconfigured"; revision: null }
  | {
      status: "configured";
      provider: ModelInput["provider"];
      model: string;
      revision: string;
      agentEnabled: boolean;
    };
export class ModelSettingsError extends Error {
  constructor(
    readonly code:
      | "busy"
      | "conflict"
      | "invalid_credentials"
      | "model_unavailable"
      | "provider_unavailable"
      | "storage_unavailable",
  ) {
    super(code);
  }
}

/** Owner-only Server storage. Neither keys nor provider response bodies leave this boundary. */
export class ModelSettingsService {
  #busy = false;
  readonly #listeners = new Set<() => void>();
  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
  /** Internal inference boundary; never serialize this credential-bearing value to clients. */
  async agentSettings(): Promise<AgentModelSettings | undefined> {
    const current = await this.#read();
    return current?.agentEnabled && current.agentEnabledAt ? current : undefined;
  }
  readonly #key: Buffer;
  constructor(
    readonly path: string,
    key: string,
    readonly fetcher: typeof fetch = fetch,
  ) {
    if (!/^[a-f0-9]{64}$/u.test(key)) throw new Error("Model encryption key must be 32 bytes.");
    this.#key = Buffer.from(key, "hex");
  }
  async summary(): Promise<ModelSettingsSummary> {
    const current = await this.#read();
    return current
      ? {
          status: "configured",
          provider: current.provider,
          model: current.model,
          revision: current.revision,
          agentEnabled: current.agentEnabled,
        }
      : { status: "unconfigured", revision: null };
  }
  async save(value: z.input<typeof modelSettingsInputSchema>): Promise<ModelSettingsSummary> {
    const input = modelSettingsInputSchema.parse(value);
    if (this.#busy) throw new ModelSettingsError("busy");
    this.#busy = true;
    try {
      const current = await this.#read();
      if ((current?.revision ?? null) !== input.revision) throw new ModelSettingsError("conflict");
      await this.#verify(input);
      const stored = {
        ...input,
        revision: randomUUID(),
        agentEnabledAt: input.agentEnabled
          ? ((current?.agentEnabled ? current.agentEnabledAt : null) ?? new Date().toISOString())
          : null,
      };
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", this.#key, nonce);
      cipher.setAAD(Buffer.from("openbot.model-settings/v1"));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(stored)), cipher.final()]);
      const envelope = JSON.stringify({
        version: 1,
        nonce: nonce.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        ciphertext: ciphertext.toString("base64"),
      });
      try {
        await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
        await writeFileAtomic(this.path, envelope, { mode: 0o600 });
        for (const listener of this.#listeners) listener();
        return await this.summary();
      } catch {
        throw new ModelSettingsError("storage_unavailable");
      }
    } finally {
      this.#busy = false;
    }
  }
  async #read(): Promise<z.infer<typeof retainedSchema> | undefined> {
    try {
      const stat = await lstat(this.path);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.size > 8192 ||
        (process.platform !== "win32" && (stat.mode & 0o077) !== 0)
      )
        throw new Error("Unsafe model file.");
      const handle = await open(
        this.path,
        constants.O_RDONLY | (process.platform === "win32" ? 0 : constants.O_NOFOLLOW),
      );
      let text: string;
      try {
        const opened = await handle.stat();
        if (
          opened.ino !== stat.ino ||
          opened.dev !== stat.dev ||
          opened.size > 8192 ||
          (process.platform !== "win32" && (opened.mode & 0o077) !== 0)
        )
          throw new Error("Model file changed.");
        const buffer = Buffer.alloc(8193);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        if (bytesRead > 8192) throw new Error("Model file grew.");
        text = buffer.subarray(0, bytesRead).toString("utf8");
      } finally {
        await handle.close();
      }
      const envelope = z
        .object({
          version: z.literal(1),
          nonce: z.string().max(24),
          tag: z.string().max(24),
          ciphertext: z.string().max(4096),
        })
        .strict()
        .parse(JSON.parse(text));
      const nonce = Buffer.from(envelope.nonce, "base64"),
        tag = Buffer.from(envelope.tag, "base64");
      if (nonce.length !== 12 || tag.length !== 16) throw new Error("Invalid cipher parameters.");
      const decipher = createDecipheriv("aes-256-gcm", this.#key, nonce);
      decipher.setAAD(Buffer.from("openbot.model-settings/v1"));
      decipher.setAuthTag(tag);
      return retainedSchema.parse(
        JSON.parse(
          Buffer.concat([
            decipher.update(Buffer.from(envelope.ciphertext, "base64")),
            decipher.final(),
          ]).toString("utf8"),
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw new ModelSettingsError("storage_unavailable");
    }
  }
  async #verify(input: ModelInput): Promise<void> {
    const origin =
      input.provider === "openai" ? "https://api.openai.com" : "https://api.anthropic.com";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (input.provider === "openai") headers.Authorization = `Bearer ${input.apiKey}`;
    else {
      headers["x-api-key"] = input.apiKey;
      headers["anthropic-version"] = "2023-06-01";
    }
    let response: Response | undefined;
    try {
      response = await this.fetcher(`${origin}/v1/models/${encodeURIComponent(input.model)}`, {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 401 || response.status === 403)
        throw new ModelSettingsError("invalid_credentials");
      if (response.status === 404) throw new ModelSettingsError("model_unavailable");
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
        throw new ModelSettingsError("provider_unavailable");
      const reader = response.body?.getReader();
      if (!reader) throw new ModelSettingsError("provider_unavailable");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > 32 * 1024) throw new ModelSettingsError("provider_unavailable");
          chunks.push(next.value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { id?: unknown };
      if (typeof body.id !== "string" || body.id.length === 0 || body.id.length > 128)
        throw new ModelSettingsError("model_unavailable");
    } catch (error) {
      if (error instanceof ModelSettingsError) throw error;
      throw new ModelSettingsError("provider_unavailable");
    } finally {
      await response?.body?.cancel().catch(() => undefined);
    }
  }
}
