import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopReportSaver } from "./report-save.js";

const id = "6d472024-ae0c-43a8-8ff7-b583c8eccb26";
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "openbot-report-save-"));
  directories.push(directory);
  const path = join(directory, "report.md");
  let current = "https://server.example";
  const fetcher = vi.fn(async (url: string) =>
    url.endsWith("/auth/session")
      ? Response.json({ authenticated: true })
      : new Response("# Verified report\n", {
          headers: {
            "content-type": "text/markdown",
            "content-disposition": "attachment; filename=\"report.md\"; filename*=UTF-8''report.md",
          },
        }),
  );
  const choosePath = vi.fn(async (_name: string): Promise<string | undefined> => path);
  const saver = new DesktopReportSaver({
    connection: () => ({ status: "configured", serverUrl: current }),
    fetch: fetcher,
    active: () => true,
    choosePath,
  });
  return {
    directory,
    path,
    fetcher,
    choosePath,
    saver,
    changeServer: () => {
      current = "https://other.example";
    },
  };
}
describe("native report saving", () => {
  it("fetches only the configured authenticated artifact and saves a new private Markdown file", async () => {
    const f = await fixture();
    expect(await f.saver.save(id)).toEqual({ status: "saved" });
    expect(await readFile(f.path, "utf8")).toBe("# Verified report\n");
    expect(f.fetcher).toHaveBeenNthCalledWith(
      1,
      `https://server.example/api/v1/artifacts/${id}/content`,
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        redirect: "manual",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(f.choosePath).toHaveBeenCalledExactlyOnceWith("report.md");
  });
  it("refuses arbitrary renderer URLs or paths before network and preserves existing files", async () => {
    const f = await fixture();
    for (const value of [
      undefined,
      null,
      {},
      "../report.md",
      "https://evil.example",
      id + "/content",
    ]) {
      expect(await f.saver.save(value)).toEqual({ status: "unavailable" });
    }
    expect(f.fetcher).not.toHaveBeenCalled();
    await writeFile(f.path, "existing");
    expect(await f.saver.save(id)).toEqual({ status: "exists" });
    expect(await readFile(f.path, "utf8")).toBe("existing");
  });
  it("does not follow a symlink at the selected filename", async () => {
    const f = await fixture();
    const target = join(f.directory, "existing.md");
    await writeFile(target, "original");
    await symlink(target, f.path, process.platform === "win32" ? "file" : undefined);
    expect(await f.saver.save(id)).toEqual({ status: "exists" });
    expect(await readFile(target, "utf8")).toBe("original");
  });
  it.each(["cancel", "switch", "logout", "extension"])(
    "rechecks authority and destination after the dialog: %s",
    async (mode) => {
      const f = await fixture();
      f.choosePath.mockImplementation(async () => {
        if (mode === "switch") f.changeServer();
        if (mode === "logout")
          f.fetcher.mockImplementation(async () => Response.json({ authenticated: false }));
        return mode === "cancel"
          ? undefined
          : mode === "extension"
            ? join(f.directory, "report.html")
            : f.path;
      });
      expect(await f.saver.save(id)).toEqual({
        status: mode === "cancel" ? "cancelled" : "unavailable",
      });
      await expect(readFile(f.path)).rejects.toThrow();
    },
  );
  it.each(["redirect", "html", "oversize", "encoding", "filename"])(
    "rejects an untrusted Server response: %s",
    async (mode) => {
      const f = await fixture();
      f.fetcher.mockImplementation(
        async () =>
          new Response(
            mode === "oversize"
              ? "a".repeat(32769)
              : mode === "encoding"
                ? new Uint8Array([255])
                : "# report",
            {
              status: mode === "redirect" ? 302 : 200,
              headers: {
                "content-type": mode === "html" ? "text/html" : "text/markdown",
                "content-disposition": `attachment; filename="report.md"; filename*=UTF-8''${mode === "filename" ? "..%2Fprivate.md" : "report.md"}`,
              },
            },
          ),
      );
      expect(await f.saver.save(id)).toEqual({ status: "unavailable" });
      expect(f.choosePath).not.toHaveBeenCalled();
    },
  );
  it("allows only one native dialog at a time", async () => {
    const f = await fixture();
    let release!: () => void;
    f.choosePath.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(undefined);
        }),
    );
    const pending = f.saver.save(id);
    await vi.waitFor(() => expect(f.choosePath).toHaveBeenCalledTimes(1));
    expect(await f.saver.save(id)).toEqual({ status: "busy" });
    release();
    expect(await pending).toEqual({ status: "cancelled" });
  });
});
