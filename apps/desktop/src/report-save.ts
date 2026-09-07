import { open, unlink } from "node:fs/promises";
import { extname, isAbsolute } from "node:path";
import type { DesktopConnectionState, DesktopServerFetcher } from "./connection-controller.js";
import { isDesktopSessionAuthenticated } from "./desktop-server-actions.js";

export type ReportSaveResult = Readonly<{
  status: "saved" | "cancelled" | "busy" | "unavailable" | "exists";
}>;
interface Options {
  connection(): DesktopConnectionState;
  fetch: DesktopServerFetcher;
  active(): boolean;
  choosePath(name: string): Promise<string | undefined>;
}

/** The renderer chooses an artifact identity; only the native dialog can choose a local path. */
export class DesktopReportSaver {
  #busy = false;
  constructor(readonly options: Options) {}
  async save(value: unknown): Promise<ReportSaveResult> {
    if (typeof value !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(value))
      return { status: "unavailable" };
    if (this.#busy) return { status: "busy" };
    const connection = this.options.connection();
    if (connection.status !== "configured" || !this.options.active())
      return { status: "unavailable" };
    this.#busy = true;
    try {
      const url = new URL(`/api/v1/artifacts/${value}/content`, connection.serverUrl);
      const response = await this.options.fetch(url.href, {
        method: "GET",
        credentials: "include",
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
        headers: { Accept: "text/markdown" },
      });
      const bytes = await readReport(response);
      const disposition = response.headers.get("content-disposition") ?? "";
      if (disposition.length > 1024) return { status: "unavailable" };
      const encodedName = /^attachment; filename="report\.md"; filename\*=UTF-8''([^;]+)$/u.exec(
        disposition,
      )?.[1];
      const name = encodedName ? decodeURIComponent(encodedName) : "";
      if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,100}\.md$/u.test(name))
        return { status: "unavailable" };
      const sameConnection = () => {
        const current = this.options.connection();
        return (
          this.options.active() &&
          current.status === "configured" &&
          current.serverUrl === connection.serverUrl
        );
      };
      if (!sameConnection()) return { status: "unavailable" };
      const path = await this.options.choosePath(name);
      if (path === undefined) return { status: "cancelled" };
      if (!isAbsolute(path) || extname(path) !== ".md" || !sameConnection())
        return { status: "unavailable" };
      if (
        !(await isDesktopSessionAuthenticated(connection, this.options.fetch)) ||
        !sameConnection()
      )
        return { status: "unavailable" };
      const handle = await open(path, "wx", 0o600);
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } catch (error) {
        await handle.close();
        await unlink(path).catch(() => undefined);
        throw error;
      }
      await handle.close();
      return { status: "saved" };
    } catch (error) {
      return {
        status:
          error instanceof Error && "code" in error && error.code === "EEXIST"
            ? "exists"
            : "unavailable",
      };
    } finally {
      this.#busy = false;
    }
  }
}

async function readReport(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing report body.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    if (response.status !== 200 || response.headers.get("content-type") !== "text/markdown")
      throw new Error("Invalid report response.");
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 32 * 1024) throw new Error("Report too large.");
      chunks.push(next.value);
    }
    const bytes = Buffer.concat(chunks);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.trim() || text.includes("\0")) throw new Error("Invalid report text.");
    return bytes;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
