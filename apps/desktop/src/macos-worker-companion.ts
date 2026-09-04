import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import { join } from "node:path";
import type { Readable, Writable } from "node:stream";
import type { DesktopLocalWorkerState } from "./runtime-contract.js";

export const MACOS_WORKER_COMPANION_APP_NAME = "OpenBot Worker Host.app";
export const MACOS_WORKER_COMPANION_RELATIVE_EXECUTABLE = join(
  MACOS_WORKER_COMPANION_APP_NAME,
  "Contents",
  "MacOS",
  "OpenBotWorkerHostControl",
);
export const MACOS_WORKER_COMPANION_TIMEOUT_MS = 15_000;
export const MAXIMUM_MACOS_WORKER_COMPANION_BYTES = 8 * 1024;

const requestFormat = "openbot.macos-desktop-control/v1";
const resultFormat = "openbot.macos-desktop-control-result/v1";
const nativeStatuses = new Set([
  "not-configured",
  "disabled",
  "requires-approval",
  "enabled",
  "invalid",
]);

export type MacOSWorkerCompanionRequest =
  | Readonly<{ action: "status" | "enable" | "open-settings"; format: typeof requestFormat }>
  | Readonly<{
      action: "enroll";
      enrollmentToken: string;
      format: typeof requestFormat;
      nodeId: string;
      serverUrl: string;
    }>;

export interface MacOSWorkerCompanionInvoker {
  invoke(request: MacOSWorkerCompanionRequest): Promise<DesktopLocalWorkerState>;
}

interface CompanionProcess {
  stdin: Pick<Writable, "end" | "on" | "write">;
  stdout: Pick<Readable, "on">;
  kill(signal: NodeJS.Signals): boolean;
  once(event: "error", listener: (error: Error) => void): this;
  once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}

type CompanionSpawner = (
  executable: string,
  arguments_: readonly string[],
  options: Readonly<{
    cwd: string;
    detached: false;
    env: Readonly<Record<string, string>>;
    shell: false;
    stdio: readonly ["pipe", "pipe", "ignore"];
    windowsHide: true;
  }>,
) => CompanionProcess;

export function macOSWorkerCompanionExecutable(resourcesPath: string): string {
  return join(resourcesPath, MACOS_WORKER_COMPANION_RELATIVE_EXECUTABLE);
}

export function macOSWorkerStatusRequest(): MacOSWorkerCompanionRequest {
  return Object.freeze({ action: "status", format: requestFormat });
}

export function macOSWorkerEnableRequest(): MacOSWorkerCompanionRequest {
  return Object.freeze({ action: "enable", format: requestFormat });
}

export function macOSWorkerOpenSettingsRequest(): MacOSWorkerCompanionRequest {
  return Object.freeze({ action: "open-settings", format: requestFormat });
}

export function macOSWorkerEnrollRequest(input: {
  enrollmentToken: string;
  nodeId: string;
  serverUrl: string;
}): MacOSWorkerCompanionRequest {
  return Object.freeze({
    action: "enroll",
    enrollmentToken: input.enrollmentToken,
    format: requestFormat,
    nodeId: input.nodeId,
    serverUrl: input.serverUrl,
  });
}

export class MacOSWorkerCompanion implements MacOSWorkerCompanionInvoker {
  readonly #resourcesPath: string;
  readonly #spawn: CompanionSpawner;

  constructor(resourcesPath: string, spawnProcess: CompanionSpawner = spawn as CompanionSpawner) {
    this.#resourcesPath = resourcesPath;
    this.#spawn = spawnProcess;
  }

  async invoke(request: MacOSWorkerCompanionRequest): Promise<DesktopLocalWorkerState> {
    const executable = macOSWorkerCompanionExecutable(this.#resourcesPath);
    try {
      const [application, contents, executableDirectory, binary] = await Promise.all([
        lstat(join(this.#resourcesPath, MACOS_WORKER_COMPANION_APP_NAME)),
        lstat(join(this.#resourcesPath, MACOS_WORKER_COMPANION_APP_NAME, "Contents")),
        lstat(join(this.#resourcesPath, MACOS_WORKER_COMPANION_APP_NAME, "Contents", "MacOS")),
        lstat(executable),
      ]);
      if (
        !application.isDirectory() ||
        application.isSymbolicLink() ||
        !contents.isDirectory() ||
        contents.isSymbolicLink() ||
        !executableDirectory.isDirectory() ||
        executableDirectory.isSymbolicLink() ||
        !binary.isFile() ||
        binary.isSymbolicLink() ||
        binary.nlink !== 1 ||
        binary.size < 16 * 1024 ||
        binary.size > 32 * 1024 * 1024 ||
        (binary.mode & 0o111) === 0
      ) {
        return unavailableState();
      }
    } catch {
      return unavailableState();
    }

    return invokeCompanion(this.#spawn, executable, request);
  }
}

function invokeCompanion(
  spawnProcess: CompanionSpawner,
  executable: string,
  request: MacOSWorkerCompanionRequest,
): Promise<DesktopLocalWorkerState> {
  return new Promise((resolve) => {
    const frame = Buffer.from(`${JSON.stringify(request)}\n`, "utf8");
    let frameCleared = false;
    const clearFrame = () => {
      if (frameCleared) return;
      frame.fill(0);
      frameCleared = true;
    };
    if (frame.byteLength > MAXIMUM_MACOS_WORKER_COMPANION_BYTES + 1) {
      clearFrame();
      resolve(invalidState());
      return;
    }

    let child: CompanionProcess;
    try {
      child = spawnProcess(executable, ["--desktop-control"], {
        cwd: join(executable, "..", "..", ".."),
        detached: false,
        env: Object.freeze({}),
        shell: false,
        stdio: ["pipe", "pipe", "ignore"],
        windowsHide: true,
      });
    } catch {
      clearFrame();
      resolve(invalidState());
      return;
    }

    let settled = false;
    let overflow = false;
    const chunks: Buffer[] = [];
    let outputBytes = 0;
    const finish = (state: DesktopLocalWorkerState) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearFrame();
      resolve(state);
    };
    const abort = () => {
      if (settled) return;
      try {
        child.kill("SIGKILL");
      } catch {
        // The process may already have exited; the result still fails closed.
      }
      finish(invalidState());
    };
    const timer = setTimeout(() => {
      abort();
    }, MACOS_WORKER_COMPANION_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer | Uint8Array | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      outputBytes += bytes.byteLength;
      if (outputBytes > MAXIMUM_MACOS_WORKER_COMPANION_BYTES + 1) {
        overflow = true;
        abort();
        return;
      }
      chunks.push(bytes);
    });
    child.stdout.on("error", abort);
    child.stdin.on("error", abort);
    child.once("error", abort);
    child.once("exit", (code, signal) => {
      if (overflow || code !== 0 || signal !== null) {
        finish(invalidState());
        return;
      }
      finish(parseCompanionResponse(Buffer.concat(chunks, outputBytes)));
    });

    try {
      child.stdin.write(frame, () => {
        clearFrame();
        if (!settled) child.stdin.end();
      });
    } catch {
      abort();
    }
  });
}

export function parseCompanionResponse(bytes: Uint8Array): DesktopLocalWorkerState {
  if (
    bytes.byteLength < 2 ||
    bytes.byteLength > MAXIMUM_MACOS_WORKER_COMPANION_BYTES + 1 ||
    bytes[bytes.byteLength - 1] !== 0x0a ||
    bytes.subarray(0, -1).includes(0x0a)
  ) {
    return invalidState();
  }
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, -1));
    const value = JSON.parse(source) as unknown;
    if (!isRecord(value) || Object.keys(value).sort().join(",") !== "format,status") {
      return invalidState();
    }
    if (value.format !== resultFormat || !nativeStatuses.has(String(value.status))) {
      return invalidState();
    }
    if (source !== JSON.stringify({ format: resultFormat, status: value.status })) {
      return invalidState();
    }
    return Object.freeze({ status: value.status as DesktopLocalWorkerState["status"] });
  } catch {
    return invalidState();
  }
}

function unavailableState(): DesktopLocalWorkerState {
  return Object.freeze({ status: "unavailable" });
}

function invalidState(): DesktopLocalWorkerState {
  return Object.freeze({ status: "invalid" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
