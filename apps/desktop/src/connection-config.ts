import { RestrictedJsonFile } from "./restricted-json-file.js";

export const DESKTOP_CONNECTION_CONFIG_FORMAT = "openbot.desktop-connection/v1" as const;
export const MAXIMUM_DESKTOP_CONNECTION_CONFIG_BYTES = 4 * 1024;
export const MAXIMUM_DESKTOP_SERVER_URL_BYTES = 2 * 1024;

export interface DesktopConnectionConfig {
  format: typeof DESKTOP_CONNECTION_CONFIG_FORMAT;
  serverUrl: string;
}

export interface DesktopConnectionStore {
  load(): Promise<DesktopConnectionConfig | undefined>;
  save(config: DesktopConnectionConfig): Promise<void>;
}

export function normalizeDesktopServerUrl(input: unknown): string {
  if (typeof input !== "string") throw new Error("Desktop Server URL must be a string.");
  const value = input.trim();
  if (value.length === 0 || Buffer.byteLength(value) > MAXIMUM_DESKTOP_SERVER_URL_BYTES) {
    throw new Error("Desktop Server URL length is invalid.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Desktop Server URL is invalid.");
  }

  if (url.username !== "" || url.password !== "") {
    throw new Error("Desktop Server URL must not contain credentials.");
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    throw new Error("Desktop Server URL must contain only an origin.");
  }
  if (url.protocol === "http:" && isLoopbackHostname(url.hostname)) return url.origin;
  if (url.protocol === "https:") return url.origin;
  throw new Error("Desktop Server URL must use HTTPS, except on loopback.");
}

export function parseDesktopConnectionConfig(input: string): DesktopConnectionConfig {
  if (Buffer.byteLength(input) > MAXIMUM_DESKTOP_CONNECTION_CONFIG_BYTES) {
    throw new Error("Desktop connection configuration exceeds the 4 KiB limit.");
  }

  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error("Desktop connection configuration must be valid JSON.");
  }
  if (!isRecord(value)) throw new Error("Desktop connection configuration must be an object.");
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "format" || keys[1] !== "serverUrl") {
    throw new Error("Desktop connection configuration contains unknown fields.");
  }
  if (value.format !== DESKTOP_CONNECTION_CONFIG_FORMAT) {
    throw new Error("Desktop connection configuration version is unsupported.");
  }
  const serverUrl = normalizeDesktopServerUrl(value.serverUrl);
  if (serverUrl !== value.serverUrl) {
    throw new Error("Desktop connection configuration is not canonical.");
  }
  return Object.freeze({ format: DESKTOP_CONNECTION_CONFIG_FORMAT, serverUrl });
}

export class FileDesktopConnectionStore implements DesktopConnectionStore {
  readonly #file: RestrictedJsonFile<DesktopConnectionConfig>;

  constructor(path: string) {
    this.#file = new RestrictedJsonFile(path, {
      label: "Desktop connection configuration",
      maximumBytes: MAXIMUM_DESKTOP_CONNECTION_CONFIG_BYTES,
      parse: parseDesktopConnectionConfig,
    });
  }

  async load(): Promise<DesktopConnectionConfig | undefined> {
    return this.#file.load();
  }

  async save(config: DesktopConnectionConfig): Promise<void> {
    await this.#file.save(config);
  }
}

export function createDesktopConnectionConfig(serverUrl: string): DesktopConnectionConfig {
  return Object.freeze({
    format: DESKTOP_CONNECTION_CONFIG_FORMAT,
    serverUrl: normalizeDesktopServerUrl(serverUrl),
  });
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/u.test(normalized)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
