import type { DesktopConnectionState, DesktopServerFetcher } from "./connection-controller.js";
import { proxyDesktopServerRequest } from "./server-proxy.js";

const MAXIMUM_DESKTOP_ACTION_RESPONSE_BYTES = 4 * 1024;
const enrollmentTokenPattern = /^obenr_[A-Za-z0-9_-]+$/u;

export type DesktopEnrollmentTokenResult =
  | Readonly<{ status: "issued"; token: string }>
  | Readonly<{ status: "authentication-required" | "server-unavailable" }>;

export async function isDesktopSessionAuthenticated(
  connection: DesktopConnectionState,
  fetcher: DesktopServerFetcher,
): Promise<boolean> {
  const response = await proxyDesktopServerRequest(
    new Request("openbot://app/api/v1/auth/session", {
      headers: { Accept: "application/json" },
    }),
    connection,
    fetcher,
  );
  if (response?.status !== 200 || !isJson(response.headers.get("content-type"))) return false;
  try {
    const value = JSON.parse(
      await readBoundedText(response, MAXIMUM_DESKTOP_ACTION_RESPONSE_BYTES),
    ) as unknown;
    return isRecord(value) && value.authenticated === true;
  } catch {
    return false;
  }
}

export async function issueDesktopNodeEnrollmentToken(
  nodeId: string,
  connection: DesktopConnectionState,
  fetcher: DesktopServerFetcher,
  now = Date.now(),
): Promise<DesktopEnrollmentTokenResult> {
  const response = await proxyDesktopServerRequest(
    new Request("openbot://app/api/v1/nodes/enrollment-tokens", {
      body: JSON.stringify({ expiresInSeconds: 600, nodeId }),
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      method: "POST",
    }),
    connection,
    fetcher,
  );
  if (response?.status === 401) {
    await response.body?.cancel().catch(() => undefined);
    return Object.freeze({ status: "authentication-required" });
  }
  if (response?.status !== 201 || !isJson(response.headers.get("content-type"))) {
    await response?.body?.cancel().catch(() => undefined);
    return Object.freeze({ status: "server-unavailable" });
  }

  try {
    const value = JSON.parse(
      await readBoundedText(response, MAXIMUM_DESKTOP_ACTION_RESPONSE_BYTES),
    ) as unknown;
    if (
      !isRecord(value) ||
      Object.keys(value).sort().join(",") !== "expiresAt,nodeId,token" ||
      value.nodeId !== nodeId ||
      typeof value.token !== "string" ||
      value.token.length < 48 ||
      value.token.length > 256 ||
      !enrollmentTokenPattern.test(value.token) ||
      typeof value.expiresAt !== "string"
    ) {
      return Object.freeze({ status: "server-unavailable" });
    }
    const expiresAt = Date.parse(value.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + 11 * 60 * 1_000) {
      return Object.freeze({ status: "server-unavailable" });
    }
    return Object.freeze({ status: "issued", token: value.token });
  } catch {
    return Object.freeze({ status: "server-unavailable" });
  }
}

async function readBoundedText(response: Response, maximumBytes: number): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const parsed = Number(declaredLength);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximumBytes) {
      throw new Error("Response length is invalid.");
    }
  }
  if (response.body === null) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > maximumBytes) throw new Error("Response exceeds its byte limit.");
      chunks.push(result.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function isJson(value: string | null): boolean {
  return value?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
