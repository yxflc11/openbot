import { chmod, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDesktopConnectionConfig,
  DESKTOP_CONNECTION_CONFIG_FORMAT,
  FileDesktopConnectionStore,
  MAXIMUM_DESKTOP_CONNECTION_CONFIG_BYTES,
  normalizeDesktopServerUrl,
  parseDesktopConnectionConfig,
} from "./connection-config.js";

describe("Desktop Server URL policy", () => {
  it.each([
    ["https://openbot.example", "https://openbot.example"],
    [" https://openbot.example:8443/ ", "https://openbot.example:8443"],
    ["http://localhost:3001", "http://localhost:3001"],
    ["http://worker.localhost:3001/", "http://worker.localhost:3001"],
    ["http://127.4.3.2:3001", "http://127.4.3.2:3001"],
    ["http://[::1]:3001", "http://[::1]:3001"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeDesktopServerUrl(input)).toBe(expected);
  });

  it.each([
    "",
    "openbot.example",
    "http://openbot.example",
    "ws://localhost:3001",
    "file:///tmp/server",
    ["https", "://owner:secret@openbot.example"].join(""),
    "https://openbot.example/base",
    "https://openbot.example/?token=secret",
    "https://openbot.example/#fragment",
  ])("rejects unsafe or ambiguous URL %s", (input) => {
    expect(() => normalizeDesktopServerUrl(input)).toThrow();
  });

  it("accepts only the exact canonical versioned configuration", () => {
    const config = parseDesktopConnectionConfig(
      JSON.stringify({
        format: DESKTOP_CONNECTION_CONFIG_FORMAT,
        serverUrl: "https://openbot.example",
      }),
    );
    expect(config).toEqual({
      format: DESKTOP_CONNECTION_CONFIG_FORMAT,
      serverUrl: "https://openbot.example",
    });
    expect(Object.isFrozen(config)).toBe(true);

    expect(() =>
      parseDesktopConnectionConfig(
        JSON.stringify({ ...config, serverUrl: "https://openbot.example/" }),
      ),
    ).toThrow(/canonical/u);
    expect(() => parseDesktopConnectionConfig(JSON.stringify({ ...config, extra: true }))).toThrow(
      /unknown/u,
    );
    expect(() =>
      parseDesktopConnectionConfig(JSON.stringify({ ...config, format: "openbot.desktop/v2" })),
    ).toThrow(/version/u);
  });
});

describe("Desktop connection file", () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it("atomically creates and reloads only the public Server origin", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "connection", "server.json");
    const store = new FileDesktopConnectionStore(path);
    expect(await store.load()).toBeUndefined();

    await store.save(createDesktopConnectionConfig("https://openbot.example/"));

    expect(await store.load()).toEqual({
      format: DESKTOP_CONNECTION_CONFIG_FORMAT,
      serverUrl: "https://openbot.example",
    });
    expect(await readFile(path, "utf8")).toBe(
      `${JSON.stringify({
        format: DESKTOP_CONNECTION_CONFIG_FORMAT,
        serverUrl: "https://openbot.example",
      })}\n`,
    );
  });

  it("rejects oversized and malformed retained bytes", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "server.json");
    const store = new FileDesktopConnectionStore(path);
    await writeFile(path, "x".repeat(MAXIMUM_DESKTOP_CONNECTION_CONFIG_BYTES + 1), { mode: 0o600 });
    await expect(store.load()).rejects.toThrow(/4 KiB/u);
    await writeFile(path, "not-json", { mode: 0o600 });
    await expect(store.load()).rejects.toThrow(/valid JSON/u);
  });

  it("replaces a malformed regular file with a canonical restricted configuration", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "server.json");
    const store = new FileDesktopConnectionStore(path);
    await writeFile(path, "malformed", { mode: 0o644 });

    await store.save(createDesktopConnectionConfig("https://openbot.example"));

    await expect(store.load()).resolves.toEqual(
      createDesktopConnectionConfig("https://openbot.example"),
    );
  });

  it("rejects symlinks and exposed POSIX permissions", async () => {
    if (process.platform === "win32") return;
    const directory = await temporaryDirectory();
    const target = join(directory, "target.json");
    const path = join(directory, "server.json");
    await writeFile(
      target,
      `${JSON.stringify(createDesktopConnectionConfig("https://openbot.example"))}\n`,
      { mode: 0o600 },
    );
    await symlink(target, path);
    const linkedStore = new FileDesktopConnectionStore(path);
    await expect(linkedStore.load()).rejects.toThrow(/regular file/u);
    await expect(
      linkedStore.save(createDesktopConnectionConfig("https://replacement.example")),
    ).rejects.toThrow(/regular file/u);
    expect(await readFile(target, "utf8")).toContain("https://openbot.example");
    await rm(path);
    await chmod(target, 0o644);
    await expect(new FileDesktopConnectionStore(target).load()).rejects.toThrow(/permissions/u);
  });

  async function temporaryDirectory(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "openbot-desktop-connection-"));
    directories.push(directory);
    return directory;
  }
});
