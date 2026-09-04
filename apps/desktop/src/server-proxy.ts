import type { DesktopConnectionState, DesktopServerFetcher } from "./connection-controller.js";
import { DESKTOP_SCHEME } from "./local-content.js";

export const MAXIMUM_DESKTOP_PROXY_REQUEST_BYTES = 3 * 1024 * 1024;
export const MAXIMUM_DESKTOP_PROXY_URL_BYTES = 8 * 1024;
export const DESKTOP_PROXY_REQUEST_TIMEOUT_MS = 30_000;

const allowedMethods = new Set(["DELETE", "GET", "PATCH", "POST"]);
const mutationMethods = new Set(["DELETE", "PATCH", "POST"]);
const forwardedRequestHeaders = new Set(["accept", "content-type", "if-match", "last-event-id"]);
const exposedResponseHeaders = new Set([
  "cache-control",
  "content-disposition",
  "content-type",
  "etag",
  "retry-after",
  "x-request-id",
]);
const forbiddenCredentialHeaders = ["authorization", "cookie", "proxy-authorization"];

export async function proxyDesktopServerRequest(
  request: Request,
  connection: DesktopConnectionState,
  fetcher: DesktopServerFetcher,
): Promise<Response | undefined> {
  const requestUrl = parseDesktopApiRequestUrl(request.url);
  if (requestUrl === undefined) return undefined;
  if (connection.status !== "configured") {
    return jsonError(503, "OpenBot Desktop is not connected to a Server.");
  }

  const method = request.method.toUpperCase();
  if (!allowedMethods.has(method)) {
    return jsonError(405, "Desktop Server request method is not allowed.", {
      Allow: [...allowedMethods].sort().join(", "),
    });
  }
  if (forbiddenCredentialHeaders.some((header) => request.headers.has(header))) {
    return jsonError(400, "Desktop renderer credentials are not accepted.");
  }

  let body: Uint8Array | undefined;
  try {
    body = await readBoundedRequestBody(request, MAXIMUM_DESKTOP_PROXY_REQUEST_BYTES);
  } catch {
    return jsonError(413, "Desktop Server request is too large.");
  }

  const target = new URL(connection.serverUrl);
  target.pathname = requestUrl.pathname;
  target.search = requestUrl.search;
  const headers = new Headers();
  for (const name of forwardedRequestHeaders) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (mutationMethods.has(method)) headers.set("Origin", target.origin);

  const eventStream = headers.get("accept")?.includes("text/event-stream") === true;
  const signal = eventStream
    ? request.signal
    : AbortSignal.any([request.signal, AbortSignal.timeout(DESKTOP_PROXY_REQUEST_TIMEOUT_MS)]);

  let response: Response;
  try {
    response = await fetcher(target.toString(), {
      ...(body === undefined ? {} : { body }),
      credentials: "include",
      headers,
      method,
      redirect: "manual",
      signal,
    });
  } catch {
    return jsonError(502, "OpenBot Server is unavailable.");
  }

  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel().catch(() => undefined);
    return jsonError(502, "OpenBot Server redirects are not allowed.");
  }

  const responseHeaders = new Headers();
  for (const name of exposedResponseHeaders) {
    const value = response.headers.get(name);
    if (value !== null) responseHeaders.set(name, value);
  }
  return new Response(response.body, {
    headers: responseHeaders,
    status: response.status,
    statusText: response.statusText,
  });
}

export function parseDesktopApiRequestUrl(input: string): URL | undefined {
  if (Buffer.byteLength(input) > MAXIMUM_DESKTOP_PROXY_URL_BYTES) return undefined;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return undefined;
  }
  if (
    url.protocol !== `${DESKTOP_SCHEME}:` ||
    url.hostname !== "app" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.hash !== "" ||
    !url.pathname.startsWith("/api/v1/")
  ) {
    return undefined;
  }
  return url;
}

async function readBoundedRequestBody(
  request: Request,
  maximumBytes: number,
): Promise<Uint8Array | undefined> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsed = Number(declaredLength);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximumBytes) {
      throw new Error("Request length is invalid.");
    }
  }
  if (request.body === null) return undefined;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > maximumBytes) throw new Error("Request exceeds its byte limit.");
      chunks.push(result.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }

  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function jsonError(
  status: number,
  error: string,
  headers?: Readonly<Record<string, string>>,
): Response {
  return new Response(JSON.stringify({ error }), {
    headers: { "Content-Type": "application/json", ...headers },
    status,
  });
}
