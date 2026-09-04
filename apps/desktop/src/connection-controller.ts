import {
  createDesktopConnectionConfig,
  type DesktopConnectionStore,
  normalizeDesktopServerUrl,
} from "./connection-config.js";

export const MAXIMUM_DESKTOP_HEALTH_RESPONSE_BYTES = 4 * 1024;
export const DESKTOP_SERVER_HEALTH_TIMEOUT_MS = 5_000;

export type DesktopConnectionState =
  | Readonly<{ status: "unconfigured" }>
  | Readonly<{ status: "invalid" }>
  | Readonly<{ status: "configured"; serverUrl: string }>;

export type DesktopConnectionFailureCode =
  | "invalid_url"
  | "server_unreachable"
  | "server_redirected"
  | "not_openbot_server"
  | "confirmation_unavailable"
  | "storage_unavailable";

export type ConfigureDesktopServerResult =
  | Readonly<{ status: "configured"; serverUrl: string }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "failed"; code: DesktopConnectionFailureCode }>;

export type DesktopServerFetcher = (input: string, init: RequestInit) => Promise<Response>;

export interface DesktopConnectionControllerOptions {
  clearSessionData(): Promise<void>;
  confirmServer(serverUrl: string): Promise<boolean>;
  fetch: DesktopServerFetcher;
  store: DesktopConnectionStore;
}

export class DesktopConnectionController {
  readonly #options: DesktopConnectionControllerOptions;
  #state: DesktopConnectionState = unconfiguredState();

  constructor(options: DesktopConnectionControllerOptions) {
    this.#options = options;
  }

  async initialize(): Promise<DesktopConnectionState> {
    try {
      const config = await this.#options.store.load();
      this.#state = config ? configuredState(config.serverUrl) : unconfiguredState();
    } catch {
      this.#state = invalidState();
    }
    return this.getState();
  }

  getState(): DesktopConnectionState {
    if (this.#state.status === "configured") return configuredState(this.#state.serverUrl);
    return this.#state.status === "invalid" ? invalidState() : unconfiguredState();
  }

  getServerUrl(): string | undefined {
    return this.#state.status === "configured" ? this.#state.serverUrl : undefined;
  }

  async configure(input: unknown): Promise<ConfigureDesktopServerResult> {
    let serverUrl: string;
    try {
      serverUrl = normalizeDesktopServerUrl(input);
    } catch {
      return failedResult("invalid_url");
    }

    const healthFailure = await verifyDesktopServer(this.#options.fetch, serverUrl);
    if (healthFailure !== undefined) return failedResult(healthFailure);

    let confirmed: boolean;
    try {
      confirmed = await this.#options.confirmServer(serverUrl);
    } catch {
      return failedResult("confirmation_unavailable");
    }
    if (!confirmed) return Object.freeze({ status: "cancelled" });

    if (this.#state.status === "configured" && this.#state.serverUrl === serverUrl) {
      return configuredState(serverUrl);
    }

    try {
      await this.#options.clearSessionData();
      await this.#options.store.save(createDesktopConnectionConfig(serverUrl));
    } catch {
      return failedResult("storage_unavailable");
    }

    this.#state = configuredState(serverUrl);
    return configuredState(serverUrl);
  }
}

export async function verifyDesktopServer(
  fetcher: DesktopServerFetcher,
  serverUrl: string,
): Promise<DesktopConnectionFailureCode | undefined> {
  let response: Response;
  try {
    response = await fetcher(`${normalizeDesktopServerUrl(serverUrl)}/health`, {
      credentials: "omit",
      headers: { Accept: "application/json" },
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(DESKTOP_SERVER_HEALTH_TIMEOUT_MS),
    });
  } catch {
    return "server_unreachable";
  }

  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel().catch(() => undefined);
    return "server_redirected";
  }
  if (response.status !== 200 || !isJsonContentType(response.headers.get("content-type"))) {
    await response.body?.cancel().catch(() => undefined);
    return "not_openbot_server";
  }

  let body: string;
  try {
    body = await readBoundedText(response, MAXIMUM_DESKTOP_HEALTH_RESPONSE_BYTES);
  } catch {
    return "not_openbot_server";
  }

  try {
    const value = JSON.parse(body) as unknown;
    if (!isRecord(value) || value.ok !== true || value.service !== "openbot-server") {
      return "not_openbot_server";
    }
  } catch {
    return "not_openbot_server";
  }
  return undefined;
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

function configuredState(serverUrl: string): Readonly<{ status: "configured"; serverUrl: string }> {
  return Object.freeze({ status: "configured", serverUrl });
}

function unconfiguredState(): Readonly<{ status: "unconfigured" }> {
  return Object.freeze({ status: "unconfigured" });
}

function invalidState(): Readonly<{ status: "invalid" }> {
  return Object.freeze({ status: "invalid" });
}

function failedResult(
  code: DesktopConnectionFailureCode,
): Readonly<{ status: "failed"; code: DesktopConnectionFailureCode }> {
  return Object.freeze({ status: "failed", code });
}

function isJsonContentType(value: string | null): boolean {
  return value?.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
