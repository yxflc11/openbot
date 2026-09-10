import { createHash } from "node:crypto";
import { z } from "zod";

export const toolName = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/u);
export const pluginEndpointInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    endpoint: z.string().url().max(2048),
    token: z
      .string()
      .min(1)
      .max(2048)
      .regex(/^[\x21-\x7e]+$/u)
      .optional(),
  })
  .strict();
export const installPluginSchema = pluginEndpointInputSchema
  .extend({
    reviewedDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();
export const pluginResourceSchema = z
  .object({
    uri: z.string().min(1).max(2048),
    name: z.string().min(1).max(128),
    description: z.string().max(2000),
    mimeType: z.string().max(128).optional(),
  })
  .strict();
export const pluginPromptSchema = z
  .object({
    name: toolName,
    description: z.string().max(2000),
    arguments: z
      .array(
        z
          .object({
            name: toolName,
            description: z.string().max(1000).optional(),
            required: z.boolean().optional(),
          })
          .strict(),
      )
      .max(16),
  })
  .strict();
export const pluginResourceResultSchema = z
  .object({
    contents: z
      .array(
        z
          .object({
            uri: z.string().max(2048),
            mimeType: z.string().max(128).optional(),
            text: z.string().max(128 * 1024),
            _meta: z.record(z.string(), z.unknown()).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(16),
  })
  .strict();
export const pluginPromptResultSchema = z
  .object({
    description: z.string().max(2000).optional(),
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.object({ type: z.literal("text"), text: z.string().max(12000) }).strict(),
          })
          .strict(),
      )
      .min(1)
      .max(16),
  })
  .strict();
export type PluginResource = z.infer<typeof pluginResourceSchema>;
export type PluginPrompt = z.infer<typeof pluginPromptSchema>;
export const readPluginContentSchema = z
  .object({
    pluginId: z.string().uuid(),
    revision: z.string().uuid(),
    kind: z.enum(["resource", "prompt"]),
    name: z.string().min(1).max(2048),
    arguments: z.record(toolName, z.string().max(4000)).default({}),
  })
  .strict();
export const applyPluginUpdateSchema = z
  .object({ revision: z.string().uuid(), reviewedDigest: z.string().regex(/^[a-f0-9]{64}$/u) })
  .strict();
export const pluginToolSchema = z
  .object({
    name: toolName,
    description: z.string().max(2000),
    inputSchema: z.record(z.string(), z.unknown()),
    annotations: z.record(z.string(), z.unknown()).optional(),
    resourceUri: z.string().startsWith("ui://").max(2048).optional(),
  })
  .strict();
export const pluginToolGrantSchema = z
  .object({
    name: toolName,
    mode: z.enum(["read", "confirm"]),
  })
  .strict();
export const updatePluginSchema = z
  .object({
    revision: z.string().uuid(),
    enabled: z.boolean(),
  })
  .strict();
export const grantPluginSchema = z
  .object({
    revision: z.string().uuid(),
    tools: z.array(pluginToolGrantSchema).max(32),
    resources: z.array(z.string().min(1).max(2048)).max(32).default([]),
    prompts: z.array(toolName).max(32).default([]),
  })
  .strict();
export const removePluginSchema = z.object({ revision: z.string().uuid() }).strict();
export const decidePluginCallSchema = z
  .object({ decision: z.enum(["approve", "reject"]) })
  .strict();

export type PluginEndpointInput = z.infer<typeof pluginEndpointInputSchema>;
export type PluginTool = z.infer<typeof pluginToolSchema>;
export type PluginToolGrant = z.infer<typeof pluginToolGrantSchema>;
export interface PluginManifest {
  name: string;
  endpoint: string;
  tools: PluginTool[];
  resources?: PluginResource[] | undefined;
  prompts?: PluginPrompt[] | undefined;
  digest: string;
}
export interface InstalledPlugin extends PluginManifest {
  id: string;
  revision: string;
  enabled: boolean;
  createdAt: string;
  grants: {
    botId: string;
    tools: PluginToolGrant[];
    resources?: string[] | undefined;
    prompts?: string[] | undefined;
  }[];
}
export interface PendingPluginCall {
  id: string;
  pluginId: string;
  pluginName: string;
  toolName: string;
  botId: string;
  channelId: string;
  runId: string;
  arguments: Record<string, unknown>;
  expiresAt: string;
}
export interface PluginCatalogItem {
  pluginId: string;
  revision: string;
  pluginName: string;
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  mode: PluginToolGrant["mode"];
}
export const callPluginSchema = z
  .object({
    pluginId: z.string().uuid(),
    revision: z.string().uuid(),
    toolName,
    arguments: z.record(z.string(), z.unknown()),
  })
  .strict();
export class PluginError extends Error {
  constructor(
    public readonly code:
      | "invalid"
      | "unavailable"
      | "conflict"
      | "forbidden"
      | "not_found"
      | "rejected"
      | "expired",
    message?: string,
  ) {
    super(
      message ??
        {
          invalid: "插件配置或调用参数无效。",
          unavailable: "插件暂不可用，请检查服务。不会自动重试。",
          conflict: "插件声明或授权已变化，请重新检查。",
          forbidden: "当前员工没有这项插件授权。",
          not_found: "插件或待审批调用不存在。",
          rejected: "插件调用已被拒绝。",
          expired: "插件调用审批已过期。",
        }[code],
    );
  }
}

export function boundedJson(value: unknown, maximumBytes: number): string {
  const text = JSON.stringify(value);
  if (!text || Buffer.byteLength(text) > maximumBytes) throw new PluginError("invalid");
  return text;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export function pluginManifest(
  name: string,
  endpoint: string,
  tools: PluginTool[],
  resources: PluginResource[] = [],
  prompts: PluginPrompt[] = [],
): PluginManifest {
  const ordered = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  if (
    !(ordered.length + resources.length + prompts.length) ||
    ordered.length > 32 ||
    new Set(ordered.map((tool) => tool.name)).size !== ordered.length
  )
    throw new PluginError("invalid");
  if (
    resources.length > 32 ||
    prompts.length > 32 ||
    new Set(resources.map((item) => item.uri)).size !== resources.length ||
    new Set(prompts.map((item) => item.name)).size !== prompts.length ||
    prompts.some(
      (item) => new Set(item.arguments.map((arg) => arg.name)).size !== item.arguments.length,
    )
  )
    throw new PluginError("invalid");
  const body = {
    name,
    endpoint,
    tools: ordered,
    ...(resources.length
      ? { resources: [...resources].sort((a, b) => a.uri.localeCompare(b.uri)) }
      : {}),
    ...(prompts.length
      ? { prompts: [...prompts].sort((a, b) => a.name.localeCompare(b.name)) }
      : {}),
  };
  const digest = createHash("sha256")
    .update(boundedJson(canonical(body), 64 * 1024))
    .digest("hex");
  return { ...body, digest };
}

/** Bounded JSON Schema subset avoids remote references and attacker-supplied regular expressions. */
export function checkPluginSchema(schema: Record<string, unknown>): void {
  boundedJson(schema, 12 * 1024);
  let nodes = 0;
  const walk = (value: unknown, depth: number): void => {
    if (depth > 12 || ++nodes > 1000) throw new PluginError("invalid");
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (
        [
          "$ref",
          "$dynamicRef",
          "$recursiveRef",
          "$id",
          "pattern",
          "patternProperties",
          "format",
          "x-mcp-header",
        ].includes(key)
      )
        throw new PluginError("invalid", "插件参数结构含当前不支持的引用、正则或请求头扩展。");
      walk(child, depth + 1);
    }
  };
  if (schema.type !== "object") throw new PluginError("invalid");
  walk(schema, 0);
}
