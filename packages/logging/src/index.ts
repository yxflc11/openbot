import pino, { type DestinationStream, type Logger as PinoLogger } from "pino";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  requestId?: string | undefined;
  runId?: string | undefined;
  nodeId?: string | undefined;
  providerId?: string | undefined;
  phase?: string | undefined;
  code?: string | undefined;
  method?: string | undefined;
  path?: string | undefined;
  status?: number | undefined;
  durationMs?: number | undefined;
  signal?: string | undefined;
  address?: string | undefined;
  port?: number | undefined;
  errorName?: string | undefined;
}

export interface OpenBotLogger {
  debug(event: string, message: string, fields?: LogFields): void;
  info(event: string, message: string, fields?: LogFields): void;
  warn(event: string, message: string, fields?: LogFields): void;
  error(event: string, message: string, fields?: LogFields): void;
  child(fields: LogFields): OpenBotLogger;
}

export interface CreateLoggerOptions {
  level: LogLevel;
  destination?: DestinationStream | undefined;
  enabled?: boolean | undefined;
}

const redactPaths = [
  "password",
  "token",
  "credential",
  "authorization",
  "cookie",
  "sessionId",
  "databaseUrl",
  "*.password",
  "*.token",
  "*.credential",
  "*.authorization",
  "*.cookie",
  "*.sessionId",
  "*.databaseUrl",
];

export function createLogger(options: CreateLoggerOptions): OpenBotLogger {
  const logger = pino(
    {
      enabled: options.enabled ?? true,
      level: options.level,
      redact: { paths: redactPaths, censor: "[REDACTED]" },
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    options.destination,
  );
  return wrapLogger(logger);
}

export function createSilentLogger(): OpenBotLogger {
  return createLogger({ enabled: false, level: "error" });
}

export function diagnosticFields(error: unknown): LogFields {
  if (!(error instanceof Error)) return { errorName: "UnknownError" };
  const errorName = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(error.name) ? error.name : "Error";
  return { errorName };
}

function wrapLogger(logger: PinoLogger): OpenBotLogger {
  const write = (level: LogLevel, event: string, message: string, fields?: LogFields) => {
    logger[level](
      { event: boundedLabel(event), ...normalizeFields(fields) },
      boundedMessage(message),
    );
  };
  return {
    debug: (event, message, fields) => write("debug", event, message, fields),
    info: (event, message, fields) => write("info", event, message, fields),
    warn: (event, message, fields) => write("warn", event, message, fields),
    error: (event, message, fields) => write("error", event, message, fields),
    child: (fields) => wrapLogger(logger.child(normalizeFields(fields))),
  };
}

function normalizeFields(fields: LogFields | undefined): Record<string, string | number> {
  if (fields === undefined) return {};
  return Object.fromEntries(
    Object.entries(fields).flatMap(([key, value]) => {
      if (value === undefined || (typeof value === "number" && !Number.isFinite(value))) return [];
      return [[key, typeof value === "string" ? boundedLabel(value) : value]];
    }),
  );
}

function boundedLabel(value: string): string {
  return replaceControlCharacters(value, "?").slice(0, 240);
}

function boundedMessage(value: string): string {
  return replaceControlCharacters(value, " ").slice(0, 500);
}

function replaceControlCharacters(value: string, replacement: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127 ? replacement : character;
  }).join("");
}
