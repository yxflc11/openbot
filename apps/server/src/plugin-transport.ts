import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { checkServerIdentity } from "node:tls";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv";
import { isPublicSourceAddress } from "./agent-sources.js";
import {
  boundedJson,
  checkPluginSchema,
  PluginError,
  type PluginTool,
  pluginToolSchema,
} from "./plugin-types.js";

export function normalizePluginEndpoint(
  value: string,
  localEndpoints: readonly string[] = [],
): URL {
  if (value.length > 2048 || value.trim() !== value) throw new PluginError("invalid");
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) throw new PluginError("invalid");
  const host = url.hostname.replace(/^\[|\]$/gu, "");
  const local = (host === "127.0.0.1" || host === "::1") && localEndpoints.includes(url.href);
  if (local && ["http:", "https:"].includes(url.protocol)) return url;
  if (
    url.protocol !== "https:" ||
    (isIP(host) && !isPublicSourceAddress(host)) ||
    (!isIP(host) &&
      (!host.includes(".") || /\.(?:local|localhost|internal|test|invalid|onion)$/iu.test(host)))
  )
    throw new PluginError(
      "invalid",
      "插件需要公开 HTTPS 地址；本机测试地址必须先由服务端明确允许。",
    );
  return url;
}

export async function abortPluginOperation<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        abort = () => reject(new PluginError("unavailable"));
        signal.addEventListener("abort", abort, { once: true });
      }),
    ]);
  } finally {
    if (abort) signal.removeEventListener("abort", abort);
  }
}

/** SDK owns MCP; this adapter pins network identity and bounds every returned HTTP body. */
export function pluginFetch(
  endpoint: string,
  token: string | undefined,
  signal: AbortSignal,
  localEndpoints: readonly string[] = [],
): typeof fetch {
  const endpointUrl = normalizePluginEndpoint(endpoint, localEndpoints);
  return async (input, init) => {
    if (String(input) !== endpointUrl.href) throw new PluginError("forbidden");
    // Server push streams are unnecessary for this bounded tools-only client.
    if (init?.method === "GET") return new Response(null, { status: 405 });
    if (
      init?.method !== "POST" ||
      typeof init.body !== "string" ||
      Buffer.byteLength(init.body) > 24 * 1024
    )
      throw new PluginError("invalid");
    const deadline = AbortSignal.any([
      signal,
      ...(init.signal ? [init.signal] : []),
      AbortSignal.timeout(30_000),
    ]);
    const hostname = endpointUrl.hostname.replace(/^\[|\]$/gu, "");
    const addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await abortPluginOperation(lookup(hostname, { all: true, verbatim: true }), deadline);
    const local =
      localEndpoints.includes(endpointUrl.href) && ["127.0.0.1", "::1"].includes(hostname);
    if (
      !addresses.length ||
      addresses.length > 32 ||
      addresses.some(
        (item) =>
          item.family !== isIP(item.address) || (!local && !isPublicSourceAddress(item.address)),
      )
    )
      throw new PluginError("forbidden");
    const address = addresses[0];
    if (!address) throw new PluginError("forbidden");
    deadline.throwIfAborted();
    const headers: Record<string, string> = {
      Host: endpointUrl.host,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "Accept-Encoding": "identity",
    };
    const sourceHeaders = new Headers(init.headers);
    for (const name of ["mcp-session-id", "mcp-protocol-version"]) {
      const value = sourceHeaders.get(name);
      if (value && value.length <= 512) headers[name] = value;
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    return await new Promise<Response>((resolve, reject) => {
      const request = endpointUrl.protocol === "https:" ? httpsRequest : httpRequest;
      const req = request(
        endpointUrl,
        {
          method: "POST",
          hostname: address.address,
          family: address.family,
          servername: isIP(hostname) ? "" : hostname,
          checkServerIdentity: (_name, cert) => checkServerIdentity(hostname, cert),
          rejectUnauthorized: true,
          agent: false,
          signal: deadline,
          headers,
        },
        (response) => {
          const status = response.statusCode ?? 500;
          const contentType = response.headers["content-type"] ?? "";
          const encoding = response.headers["content-encoding"];
          if (
            (status >= 300 && status < 400) ||
            (encoding && encoding !== "identity") ||
            Number(response.headers["content-length"] ?? 0) > 256 * 1024
          ) {
            response.destroy();
            reject(new PluginError("unavailable"));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.byteLength;
            if (size > 256 * 1024) response.destroy(new PluginError("unavailable"));
            else chunks.push(chunk);
          });
          response.on("error", () => reject(new PluginError("unavailable")));
          response.on("end", () => {
            const resultHeaders = new Headers();
            if (contentType) resultHeaders.set("content-type", contentType);
            const session = response.headers["mcp-session-id"];
            if (typeof session === "string" && session.length <= 512)
              resultHeaders.set("mcp-session-id", session);
            if (
              ![202, 204].includes(status) &&
              !/^(?:application\/json|text\/event-stream)(?:\s*;|$)/iu.test(contentType)
            ) {
              reject(new PluginError("unavailable"));
              return;
            }
            resolve(
              new Response([202, 204].includes(status) ? null : Buffer.concat(chunks), {
                status,
                headers: resultHeaders,
              }),
            );
          });
        },
      );
      req.on("error", () => reject(new PluginError("unavailable")));
      req.end(init.body);
    });
  };
}

export interface PluginConnection {
  tools(signal: AbortSignal): Promise<PluginTool[]>;
  call(name: string, args: Record<string, unknown>, signal: AbortSignal): Promise<unknown>;
  close(): Promise<void>;
}
export type PluginConnector = (
  endpoint: string,
  token: string | undefined,
  signal: AbortSignal,
) => Promise<PluginConnection>;

export function mcpPluginConnector(localEndpoints: readonly string[] = []): PluginConnector {
  return async (endpoint, token, signal) => {
    const client = new Client(
      { name: "openbot", version: "0.1.0" },
      {
        capabilities: {},
        jsonSchemaValidator: {
          getValidator(schema) {
            checkPluginSchema(schema as Record<string, unknown>);
            return new AjvJsonSchemaValidator().getValidator(schema);
          },
        },
      },
    );
    const transport = new StreamableHTTPClientTransport(
      normalizePluginEndpoint(endpoint, localEndpoints),
      {
        fetch: pluginFetch(endpoint, token, signal, localEndpoints),
        reconnectionOptions: {
          maxRetries: 0,
          initialReconnectionDelay: 1000,
          maxReconnectionDelay: 1000,
          reconnectionDelayGrowFactor: 1,
        },
      },
    );
    const abort = () => {
      void client.close().catch(() => {});
    };
    signal.addEventListener("abort", abort, { once: true });
    // SDK 1.30's optional sessionId getter conflicts with exactOptionalPropertyTypes;
    // its own Client consumes this official transport unchanged at runtime.
    try {
      await abortPluginOperation(
        client.connect(transport as Parameters<Client["connect"]>[0], { timeout: 30_000 }),
        signal,
      );
    } catch {
      signal.removeEventListener("abort", abort);
      await client.close().catch(() => {});
      throw new PluginError("unavailable");
    }
    return {
      async tools(callSignal) {
        const result = await client.listTools({}, { signal: callSignal, timeout: 30_000 });
        if (result.nextCursor || result.tools.length > 32)
          throw new PluginError("invalid", "插件工具目录过大，当前最多支持完整的32项工具。");
        return result.tools.map((tool) => {
          const checked = pluginToolSchema.parse({
            name: tool.name,
            description: tool.description ?? "",
            inputSchema: tool.inputSchema,
            ...(tool.annotations ? { annotations: tool.annotations } : {}),
          });
          checkPluginSchema(checked.inputSchema);
          new AjvJsonSchemaValidator().getValidator(checked.inputSchema);
          return checked;
        });
      },
      async call(name, args, callSignal) {
        const result = await client.callTool({ name, arguments: args }, undefined, {
          signal: callSignal,
          timeout: 30_000,
        });
        if (result.isError) throw new PluginError("unavailable");
        const content = result.content;
        if (
          !Array.isArray(content) ||
          content.some((item) => item.type !== "text" || typeof item.text !== "string")
        )
          throw new PluginError("unavailable", "插件返回了当前不支持的非文本结果。");
        const output = {
          content: content.map((item) => ({ type: "text", text: item.text })),
          ...(result.structuredContent ? { structuredContent: result.structuredContent } : {}),
        };
        boundedJson(output, 12 * 1024);
        return output;
      },
      async close() {
        signal.removeEventListener("abort", abort);
        await client.close();
      },
    };
  };
}
