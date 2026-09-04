import { EventEmitter } from "node:events";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAXIMUM_MACOS_WORKER_COMPANION_BYTES,
  MacOSWorkerCompanion,
  macOSWorkerCompanionExecutable,
  macOSWorkerStatusRequest,
  parseCompanionResponse,
} from "./macos-worker-companion.js";

describe("macOS Worker companion protocol", () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it("uses only the fixed nested executable, argv, empty environment, and private stdin", async () => {
    const resources = await stagedResources();
    const child = new FakeCompanionProcess();
    const spawnProcess = vi.fn(() => child);
    const companion = new MacOSWorkerCompanion(resources, spawnProcess);
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
    const root = await mkdtemp(join(tmpdir(), "openbot-companion-test-"));
    directories.push(root);
    const spawnProcess = vi.fn();
    await expect(
      new MacOSWorkerCompanion(root, spawnProcess).invoke(macOSWorkerStatusRequest()),
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
    const resources = await stagedResources();
    const overflowChild = new FakeCompanionProcess();
    const overflowSpawner = vi.fn(() => overflowChild);
    const overflowResult = new MacOSWorkerCompanion(resources, overflowSpawner).invoke(
      macOSWorkerStatusRequest(),
    );
    await vi.waitFor(() => expect(overflowSpawner).toHaveBeenCalledOnce());
    overflowChild.stdout.write(Buffer.alloc(MAXIMUM_MACOS_WORKER_COMPANION_BYTES + 2));
    await expect(overflowResult).resolves.toEqual({ status: "invalid" });
    expect(overflowChild.kill).toHaveBeenCalledWith("SIGKILL");

    const failedChild = new FakeCompanionProcess();
    const failedSpawner = vi.fn(() => failedChild);
    const failedResult = new MacOSWorkerCompanion(resources, failedSpawner).invoke(
      macOSWorkerStatusRequest(),
    );
    await vi.waitFor(() => expect(failedSpawner).toHaveBeenCalledOnce());
    failedChild.emit("exit", 1, null);
    await expect(failedResult).resolves.toEqual({ status: "invalid" });
  });

  it("kills and rejects a companion that exceeds the fixed deadline", async () => {
    const resources = await stagedResources();
    const child = new FakeCompanionProcess();
    const result = new MacOSWorkerCompanion(resources, () => child, 1).invoke(
      macOSWorkerStatusRequest(),
    );
    await expect(result).resolves.toEqual({ status: "invalid" });
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });

  async function stagedResources(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "openbot-companion-test-"));
    directories.push(root);
    const executable = macOSWorkerCompanionExecutable(root);
    await mkdir(join(executable, ".."), { recursive: true });
    await writeFile(executable, Buffer.alloc(16 * 1024, 0x61));
    await chmod(executable, 0o755);
    return root;
  }
});

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
