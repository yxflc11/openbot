export interface HttpServerLifecycle {
  close(callback: (error?: Error) => void): unknown;
  closeIdleConnections(): void;
  closeAllConnections(): void;
}

export interface HttpShutdownResult {
  forced: boolean;
}

/**
 * Stop accepting HTTP work, let active requests finish, then force-close stragglers.
 * Upgraded connections are owned by their protocol registry and must be closed separately.
 */
export function closeHttpServer(
  server: HttpServerLifecycle,
  graceMs: number,
): Promise<HttpShutdownResult> {
  if (!Number.isSafeInteger(graceMs) || graceMs <= 0) {
    throw new RangeError("HTTP shutdown grace period must be a positive integer.");
  }

  return new Promise((resolve, reject) => {
    let forced = false;
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      if (error !== undefined) {
        reject(error);
      } else {
        resolve({ forced });
      }
    };

    try {
      server.close(finish);
      server.closeIdleConnections();
      if (settled) return;
      timeout = setTimeout(() => {
        forced = true;
        try {
          server.closeAllConnections();
        } catch (error) {
          finish(toError(error));
        }
      }, graceMs);
      timeout.unref();
    } catch (error) {
      finish(toError(error));
    }
  });
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("HTTP server shutdown failed.");
}
