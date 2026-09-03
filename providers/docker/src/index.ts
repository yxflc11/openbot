import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ComputerProvider, ProviderArtifact, ProviderRunInput } from "@openbot/provider-sdk";

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface DockerProviderOptions {
  computerUrl: string;
  computerToken: string;
  allowPrivateHosts?: boolean;
  fetcher?: typeof fetch;
  resolveHost?: (hostname: string) => Promise<string[]>;
}

export function createDockerProvider(options: DockerProviderOptions): ComputerProvider {
  const fetcher = options.fetcher ?? fetch;
  const resolveHost = options.resolveHost ?? resolveHostname;
  const computerUrl = options.computerUrl.replace(/\/$/, "");

  return {
    id: "docker",
    displayName: "CopilotKit/OpenBot agent-computer",
    platforms: ["linux", "windows", "macos"],
    capabilities: ["browser", "screenshot"],
    capabilityManifest: [
      { id: "browser.observe", version: 1, providerId: "docker", constraints: {} },
      { id: "screen.capture", version: 1, providerId: "docker", constraints: {} },
    ],
    async execute(context, input, report, reportFrame) {
      const target = extractNavigationTarget(input);
      await assertNavigationAllowed(target, options.allowPrivateHosts === true, resolveHost);

      report({ stage: "navigate", message: `正在打开 ${target.hostname}` });
      const navigation = await computerRequest<NavigationResponse>(
        fetcher,
        `${computerUrl}/navigate`,
        options.computerToken,
        input.botId,
        context.signal,
        { method: "POST", body: JSON.stringify({ url: target.href }) },
      );
      if (typeof navigation.url !== "string" || typeof navigation.title !== "string") {
        throw new Error("agent-computer returned an invalid navigation response.");
      }

      report({ stage: "screenshot", message: "正在截取浏览器画面" });
      const screenshot = await computerRequest<ScreenshotResponse>(
        fetcher,
        `${computerUrl}/screenshot`,
        options.computerToken,
        input.botId,
        context.signal,
      );
      const artifact = screenshotArtifact(input, screenshot);
      reportFrame?.({
        mediaType: "image/png",
        base64: artifact.base64,
        ...(typeof screenshot.width === "number" ? { width: screenshot.width } : {}),
        ...(typeof screenshot.height === "number" ? { height: screenshot.height } : {}),
        capturedAt:
          typeof screenshot.capturedAt === "string"
            ? screenshot.capturedAt
            : new Date().toISOString(),
      });
      return {
        ok: true,
        summary: `已打开 ${navigation.title || navigation.url} 并截取画面。`,
        artifacts: [artifact],
      };
    },
  };
}

interface NavigationResponse {
  url?: unknown;
  title?: unknown;
}

interface ScreenshotResponse {
  base64?: unknown;
  width?: unknown;
  height?: unknown;
  capturedAt?: unknown;
  url?: unknown;
}

function extractNavigationTarget(input: ProviderRunInput): URL {
  const match = input.instruction.match(/https?:\/\/[^\s<>"']+/i);
  if (match === null) {
    throw new Error("浏览器任务必须包含一个明确的 http(s) URL；当前不会猜测或搜索目标地址。");
  }
  const raw = match[0].replace(/[),.;!?，。；！？）]+$/u, "");
  const target = new URL(raw);
  if (!(["http:", "https:"] as string[]).includes(target.protocol)) {
    throw new Error("Only http(s) navigation is supported.");
  }
  if (target.username || target.password) {
    throw new Error("Navigation URLs must not contain credentials.");
  }
  return target;
}

async function assertNavigationAllowed(
  target: URL,
  allowPrivateHosts: boolean,
  resolveHost: (hostname: string) => Promise<string[]>,
): Promise<void> {
  const hostname = target.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isAlwaysBlockedHost(hostname)) throw new Error("Cloud metadata endpoints are blocked.");
  const addresses = isIP(hostname) ? [hostname] : await resolveHost(hostname);
  if (addresses.length === 0) throw new Error("The navigation host did not resolve.");
  if (addresses.some(isAlwaysBlockedHost)) throw new Error("Cloud metadata endpoints are blocked.");
  if (!allowPrivateHosts && addresses.some(isPrivateAddress)) {
    throw new Error("Private-network navigation is disabled on this Node.");
  }
}

function isAlwaysBlockedHost(hostname: string): boolean {
  return (
    hostname === "169.254.169.254" ||
    hostname === "100.100.100.200" ||
    hostname === "fd00:ec2::254" ||
    hostname === "metadata.google.internal"
  );
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mapped ?? (isIP(normalized) === 4 ? normalized : undefined);
  if (ipv4 === undefined) return false;
  const octets = ipv4.split(".").map(Number);
  const [a = -1, b = -1] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function resolveHostname(hostname: string): Promise<string[]> {
  return (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);
}

async function computerRequest<T>(
  fetcher: typeof fetch,
  url: string,
  token: string,
  botId: string,
  signal: AbortSignal,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-openbot-bot-id": botId,
      "x-openbot-computer-token": token,
      ...init.headers,
    },
    signal,
  });
  const body = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? `agent-computer: ${body.error}`
        : `agent-computer returned ${response.status}.`,
    );
  }
  return body as T;
}

function screenshotArtifact(
  input: ProviderRunInput,
  screenshot: ScreenshotResponse,
): ProviderArtifact {
  if (typeof screenshot.base64 !== "string") {
    throw new Error("agent-computer returned a screenshot without image data.");
  }
  const bytes = Buffer.from(screenshot.base64, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SCREENSHOT_BYTES) {
    throw new Error("agent-computer screenshot exceeds the 5 MiB artifact limit.");
  }
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("agent-computer screenshot is not a PNG image.");
  }
  return {
    name: `${input.title.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 64) || "browser"}.png`,
    mediaType: "image/png",
    base64: screenshot.base64,
    metadata: screenshotMetadata(screenshot),
  };
}

function screenshotMetadata(screenshot: ScreenshotResponse): Record<string, unknown> {
  return {
    ...(typeof screenshot.width === "number" ? { width: screenshot.width } : {}),
    ...(typeof screenshot.height === "number" ? { height: screenshot.height } : {}),
    ...(typeof screenshot.capturedAt === "string" ? { capturedAt: screenshot.capturedAt } : {}),
    ...(typeof screenshot.url === "string" ? { url: screenshot.url } : {}),
  };
}
