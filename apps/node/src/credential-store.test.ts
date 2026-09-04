import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type CredentialHelper,
  FileNodeCredentialStore,
  LinuxSecretServiceNodeCredentialStore,
  runCredentialHelper,
} from "./credential-store.js";

const temporaryDirectories: string[] = [];
const identity = {
  format: "openbot.node-identity/v1" as const,
  nodeId: "linux-node",
  credential: `obn_${"a".repeat(43)}`,
  enrolledAt: "2026-09-04T00:00:00.000Z",
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("file Node credential store", () => {
  it("atomically persists and reloads a bounded identity document", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openbot-node-identity-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "private", "identity.json");
    const store = new FileNodeCredentialStore(path);

    expect(await store.load("linux-node")).toBeUndefined();
    await store.save(identity);
    expect(await store.load("linux-node")).toEqual(identity);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(identity);
    if (process.platform !== "win32") expect((await stat(path)).mode & 0o777).toBe(0o600);
    await expect(store.load("other-node")).rejects.toThrow("different Node id");
  });

  it.skipIf(process.platform === "win32")(
    "refuses a credential that became accessible to other POSIX users",
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "openbot-node-identity-"));
      temporaryDirectories.push(directory);
      const path = join(directory, "identity.json");
      const store = new FileNodeCredentialStore(path);

      await store.save(identity);
      await chmod(path, 0o644);

      await expect(store.load(identity.nodeId)).rejects.toThrow("group or other users");
    },
  );

  it.skipIf(process.platform === "win32")("refuses a symbolic-link credential path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openbot-node-identity-"));
    temporaryDirectories.push(directory);
    const target = join(directory, "target.json");
    const path = join(directory, "identity.json");
    await writeFile(target, `${JSON.stringify(identity)}\n`, { mode: 0o600 });
    await symlink(target, path);

    await expect(new FileNodeCredentialStore(path).load(identity.nodeId)).rejects.toThrow(
      "regular file",
    );
  });

  it("refuses directories, oversized content, and malformed packages", async () => {
    const directory = await mkdtemp(join(tmpdir(), "openbot-node-identity-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "identity.json");
    const store = new FileNodeCredentialStore(path);

    await mkdir(path);
    await expect(store.load(identity.nodeId)).rejects.toThrow("regular file");
    await rm(path, { recursive: true });

    await writeFile(path, "x".repeat(4 * 1024 + 1), { mode: 0o600 });
    await expect(store.load(identity.nodeId)).rejects.toThrow("4 KiB limit");

    await writeFile(path, "{}\n", { mode: 0o600 });
    await expect(store.load(identity.nodeId)).rejects.toThrow("invalid");
  });
});

describe("Linux Secret Service Node credential store", () => {
  it("stores through stdin and verifies the exact identity before returning", async () => {
    const requests: Parameters<CredentialHelper>[0][] = [];
    let stored = "";
    const helper: CredentialHelper = async (request) => {
      requests.push(request);
      if (request.arguments[0] === "store") {
        stored = request.input ?? "";
        return helperResult();
      }
      return helperResult({ stdout: Buffer.from(stored) });
    };
    const store = new LinuxSecretServiceNodeCredentialStore({ platform: "linux", helper });

    await store.save(identity);
    expect(await store.load(identity.nodeId)).toEqual(identity);
    expect(requests).toHaveLength(3);
    expect(requests[0]?.executable).toBe("/usr/bin/secret-tool");
    expect(requests[0]?.arguments).toEqual([
      "store",
      "--label=OpenBot Node linux-node",
      "application",
      "openbot",
      "kind",
      "node-identity",
      "format",
      "openbot.node-identity/v1",
      "node",
      "linux-node",
    ]);
    expect(requests[0]?.input).toBe(JSON.stringify(identity));
    expect(requests[0]?.arguments).not.toContain(identity.credential);
    expect(requests[1]?.arguments[0]).toBe("lookup");
    expect(requests[1]?.input).toBeUndefined();
  });

  it("recognizes only the reviewed empty exit-1 lookup as missing", async () => {
    const store = new LinuxSecretServiceNodeCredentialStore({
      platform: "linux",
      helper: async () => helperResult({ exitCode: 1 }),
    });
    await expect(store.load(identity.nodeId)).resolves.toBeUndefined();

    for (const result of [
      helperResult({ exitCode: 1, stderr: Buffer.from("token=helper-secret") }),
      helperResult({ exitCode: 1, stdout: Buffer.from("ambiguous") }),
      helperResult({ exitCode: 2 }),
      helperResult({ exitCode: null, signal: "SIGTERM" }),
    ]) {
      const failing = new LinuxSecretServiceNodeCredentialStore({
        platform: "linux",
        helper: async () => result,
      });
      const rejection = expect(failing.load(identity.nodeId)).rejects;
      await rejection.toThrow("Linux Secret Service operation failed.");
      await rejection.not.toThrow("helper-secret");
    }
  });

  it("rejects invalid, wrong-node, and unverified stored identities", async () => {
    const invalid = new LinuxSecretServiceNodeCredentialStore({
      platform: "linux",
      helper: async () => helperResult({ stdout: Buffer.from("not-json") }),
    });
    await expect(invalid.load(identity.nodeId)).rejects.toThrow(
      "Node credential Secret Service is invalid.",
    );

    const wrongNode = new LinuxSecretServiceNodeCredentialStore({
      platform: "linux",
      helper: async () =>
        helperResult({ stdout: Buffer.from(JSON.stringify({ ...identity, nodeId: "other-node" })) }),
    });
    await expect(wrongNode.load(identity.nodeId)).rejects.toThrow("different Node id");

    const notRetained = new LinuxSecretServiceNodeCredentialStore({
      platform: "linux",
      helper: async (request) =>
        request.arguments[0] === "store" ? helperResult() : helperResult({ exitCode: 1 }),
    });
    await expect(notRetained.save(identity)).rejects.toThrow("did not retain");
  });

  it("refuses unsupported platforms before invoking a helper", () => {
    expect(
      () => new LinuxSecretServiceNodeCredentialStore({ platform: "darwin" }),
    ).toThrow("require Linux");
  });
});

describe("bounded credential helper", () => {
  it("sends bounded input over stdin and captures output", async () => {
    const result = await runCredentialHelper({
      executable: process.execPath,
      arguments: ["-e", "process.stdin.pipe(process.stdout)"],
      input: "test-input",
      timeoutMs: 1_000,
      maximumBytes: 64,
    });
    expect(result).toMatchObject({ exitCode: 0, signal: null });
    expect(result.stdout.toString("utf8")).toBe("test-input");
    expect(result.stderr).toHaveLength(0);
  });

  it("fails closed when the executable is missing, times out, or exceeds output bounds", async () => {
    await expect(
      runCredentialHelper({
        executable: "openbot-definitely-missing-secret-tool",
        arguments: [],
        timeoutMs: 100,
        maximumBytes: 64,
      }),
    ).rejects.toThrow("helper is unavailable");
    await expect(
      runCredentialHelper({
        executable: process.execPath,
        arguments: ["-e", "setInterval(() => {}, 1_000)"],
        timeoutMs: 25,
        maximumBytes: 64,
      }),
    ).rejects.toThrow("timed out");
    await expect(
      runCredentialHelper({
        executable: process.execPath,
        arguments: ["-e", "process.stdout.write('x'.repeat(65))"],
        timeoutMs: 1_000,
        maximumBytes: 64,
      }),
    ).rejects.toThrow("4 KiB limit");
  });

  it("rejects unbounded helper requests before starting a process", async () => {
    await expect(
      runCredentialHelper({
        executable: process.execPath,
        arguments: [],
        input: "x".repeat(65),
        timeoutMs: 100,
        maximumBytes: 64,
      }),
    ).rejects.toThrow("request is invalid");
  });
});

function helperResult(
  overrides: Partial<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stdout: Buffer;
    stderr: Buffer;
  }> = {},
) {
  return {
    exitCode: 0,
    signal: null,
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    ...overrides,
  };
}
