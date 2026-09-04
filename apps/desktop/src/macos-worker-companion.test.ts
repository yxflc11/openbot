import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  MAXIMUM_MACOS_WORKER_COMPANION_BYTES,
  MacOSWorkerCompanion,
  macOSWorkerCompanionExecutable,
  macOSWorkerStatusRequest,
  parseCompanionResponse,
} from "./macos-worker-companion.js";

describe("macOS Worker companion protocol", () => {
  it("uses only the fixed nested executable, argv, empty environment, and private stdin", async () => {
    const resources = "/fixed/resources";
    const child = new FakeCompanionProcess();
    const spawnProcess = vi.fn(() => child);
    const companion = new MacOSWorkerCompanion(
      resources,
      spawnProcess,
      undefined,
      validCompanionLstat,
    );
    const result = companion.invoke(macOSWorkerStatusRequest());
    await vi.waitFor(() => expect(spawnProcess).toHaveBeenCalledOnce());

    expect(spawnProcess).toHaveBeenCalledWith(
      macOSWorkerCompanionExecutable(resources),
      ["--desktop-control"],
      expect.objectContaining({
        detached: false,
        env: {},
        shell: false,
        stdio: ["pipe", "pipe", "ignore"],
      }),
    );
    expect(child.input.toString("utf8")).toBe(
      '{"action":"status","format":"openbot.macos-desktop-control/v1"}\n',
    );
    child.stdout.write(
      '{"format":"openbot.macos-desktop-control-result/v1","status":"disabled"}\n',
    );
    child.emit("exit", 0, null);
    await expect(result).resolves.toEqual({ status: "disabled" });
  });

  it("reports an absent or linked companion as unavailable without spawning", async () => {
    const spawnProcess = vi.fn();
    await expect(
      new MacOSWorkerCompanion("/missing", spawnProcess, undefined, async () => {
        throw new Error("missing");
      }).invoke(macOSWorkerStatusRequest()),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      new MacOSWorkerCompanion("/linked", spawnProcess, undefined, async (path) =>
        companionMetadata({ directory: !path.endsWith("OpenBotWorkerHostControl"), linked: true }),
      ).invoke(macOSWorkerStatusRequest()),
    ).resolves.toEqual({ status: "unavailable" });
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("rejects noncanonical, excess, and unknown native output", () => {
    expect(
      parseCompanionResponse(
        Buffer.from('{"format":"openbot.macos-desktop-control-result/v1","status":"enabled"}\n'),
      ),
    ).toEqual({ status: "enabled" });
    for (const source of [
      '{"status":"enabled","format":"openbot.macos-desktop-control-result/v1"}\n',
      '{"format":"openbot.macos-desktop-control-result/v1","status":"root"}\n',
      '{"format":"openbot.macos-desktop-control-result/v1","status":"enabled","token":"x"}\n',
      '{"format":"openbot.macos-desktop-control-result/v1","status":"enabled"}\n\n',
    ]) {
      expect(parseCompanionResponse(Buffer.from(source))).toEqual({ status: "invalid" });
    }
  });

  it("kills and rejects a companion that overflows output or exits unsuccessfully", async () => {
    const resources = "/fixed/resources";
    const overflowChild = new FakeCompanionProcess();
    const overflowSpawner = vi.fn(() => overflowChild);
    const overflowResult = new MacOSWorkerCompanion(
      resources,
      overflowSpawner,
      undefined,
      validCompanionLstat,
    ).invoke(macOSWorkerStatusRequest());
    await vi.waitFor(() => expect(overflowSpawner).toHaveBeenCalledOnce());
    overflowChild.stdout.write(Buffer.alloc(MAXIMUM_MACOS_WORKER_COMPANION_BYTES + 2));
    await expect(overflowResult).resolves.toEqual({ status: "invalid" });
    expect(overflowChild.kill).toHaveBeenCalledWith("SIGKILL");

    const failedChild = new FakeCompanionProcess();
    const failedSpawner = vi.fn(() => failedChild);
    const failedResult = new MacOSWorkerCompanion(
      resources,
      failedSpawner,
      undefined,
      validCompanionLstat,
    ).invoke(macOSWorkerStatusRequest());
    await vi.waitFor(() => expect(failedSpawner).toHaveBeenCalledOnce());
    failedChild.emit("exit", 1, null);
    await expect(failedResult).resolves.toEqual({ status: "invalid" });
  });

  it("kills and rejects a companion that exceeds the fixed deadline", async () => {
    const child = new FakeCompanionProcess();
    const result = new MacOSWorkerCompanion(
      "/fixed/resources",
      () => child,
      1,
      validCompanionLstat,
    ).invoke(macOSWorkerStatusRequest());
    await expect(result).resolves.toEqual({ status: "invalid" });
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });
});

async function validCompanionLstat(path: string) {
  return companionMetadata({ directory: !path.endsWith("OpenBotWorkerHostControl") });
}

function companionMetadata({
  directory,
  linked = false,
}: {
  directory: boolean;
  linked?: boolean;
}) {
  return {
    isDirectory: () => directory,
    isFile: () => !directory,
    isSymbolicLink: () => linked,
    mode: directory ? 0o755 : 0o755,
    nlink: 1,
    size: directory ? 0 : 16 * 1024,
  };
}

class FakeCompanionProcess extends EventEmitter {
  readonly stdout = new PassThrough();
  input = Buffer.alloc(0);
  readonly stdin = new Writable({
    write: (chunk: Buffer, _encoding, callback) => {
      this.input = Buffer.concat([this.input, Buffer.from(chunk)]);
      callback();
    },
  });
  readonly kill = vi.fn(() => true);
}
