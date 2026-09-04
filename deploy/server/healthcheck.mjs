import { pathToFileURL } from "node:url";

const DEFAULT_PORT = 3001;
const DEFAULT_TIMEOUT_MS = 2_500;

export async function checkServerHealth({
  fetchImpl = globalThis.fetch,
  port = process.env.OPENBOT_PORT ?? DEFAULT_PORT,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new RangeError("Server health-check port must be an integer from 1 through 65535.");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new RangeError("Server health-check timeout must be an integer from 1 through 10000.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`http://127.0.0.1:${parsedPort}/health`, {
      redirect: "error",
      signal: controller.signal,
    });
    if (response.status !== 200) {
      throw new Error(`Server health endpoint returned HTTP ${response.status}.`);
    }
    const body = await response.json();
    if (body?.ok !== true || body.service !== "openbot-server") {
      throw new Error("Server health endpoint returned an unexpected identity.");
    }
  } finally {
    clearTimeout(timeout);
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await checkServerHealth();
  } catch {
    process.exitCode = 1;
  }
}
