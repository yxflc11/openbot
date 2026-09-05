import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeServerController, type NativeServerOptions } from "./native-server.js";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function options(): Promise<NativeServerOptions> {
  const root = await mkdtemp(join(tmpdir(), "openbot-native-test-"));
  dirs.push(root);
  return {
    runtimeRoot: join(root, "runtime"),
    dataRoot: join(root, "data"),
    platform: "darwin",
    encrypt: vi.fn(() => {
      throw new Error("Keychain unavailable");
    }),
    decrypt: vi.fn(),
    launchServer: vi.fn(),
    connect: vi.fn(),
  };
}
async function fakeResources(opts: NativeServerOptions) {
  await mkdir(join(opts.runtimeRoot, "postgres/bin"), { recursive: true });
  for (const name of ["postgres", "initdb"])
    await writeFile(join(opts.runtimeRoot, "postgres/bin", name), "not executable");
}
describe("Native Server boundary", () => {
  it.each(["win32", "linux"])("does not install on %s", async (platform) => {
    const opts = await options();
    const service = new NativeServerController({ ...opts, platform });
    expect(await service.start()).toEqual({ status: "failed", code: "unsupported_platform" });
    expect(opts.launchServer).not.toHaveBeenCalled();
    expect(opts.encrypt).not.toHaveBeenCalled();
  });
  it("rejects absent resources without creating bootstrap secrets", async () => {
    const opts = await options();
    const service = new NativeServerController(opts);
    expect(await service.start()).toEqual({ status: "failed", code: "installation_failed" });
    expect(opts.encrypt).not.toHaveBeenCalled();
    expect(opts.connect).not.toHaveBeenCalled();
  });
  it("preserves an existing cluster if its bootstrap identity is missing", async () => {
    const opts = await options();
    await fakeResources(opts);
    await mkdir(join(opts.dataRoot, "postgres"), { recursive: true, mode: 0o700 });
    await writeFile(join(opts.dataRoot, "postgres", "do-not-delete"), "retained");
    expect((await new NativeServerController(opts).start()).status).toBe("failed");
    expect(await readFile(join(opts.dataRoot, "postgres", "do-not-delete"), "utf8")).toBe(
      "retained",
    );
    expect(opts.encrypt).not.toHaveBeenCalled();
  });
  it("deduplicates clicks and never launches when encryption is unavailable", async () => {
    const opts = await options();
    await fakeResources(opts);
    const service = new NativeServerController(opts);
    const first = service.start();
    expect(service.start()).toBe(first);
    await first;
    expect(opts.encrypt).toHaveBeenCalledOnce();
    expect(opts.launchServer).not.toHaveBeenCalled();
    await service.stop();
    expect(service.getState()).toEqual({ status: "idle" });
  });
});
