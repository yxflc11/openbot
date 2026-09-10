import { createHash } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import { extname, isAbsolute } from "node:path";
import type { DesktopConnectionState, DesktopServerFetcher } from "./connection-controller.js";
import { isDesktopSessionAuthenticated } from "./desktop-server-actions.js";

export type ReportSaveResult = Readonly<{
  status: "saved" | "cancelled" | "busy" | "unavailable" | "exists";
}>;
export type EmployeeTemplateSaveInput = Readonly<{
  botId: string;
  packageId: string;
  generatedAt: string;
  downloadReviewToken: string;
}>;
export type EmployeeTemplateSaveResult = ReportSaveResult | Readonly<{ status: "changed" }>;

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
    return this.#save(value) as Promise<ReportSaveResult>;
  }
  async saveEmployeeTemplate(value: unknown): Promise<EmployeeTemplateSaveResult> {
    if (!isEmployeeTemplateSaveInput(value)) return { status: "unavailable" };
    return this.#save(value);
  }
  async #save(value: string | EmployeeTemplateSaveInput): Promise<EmployeeTemplateSaveResult> {
    if (this.#busy) return { status: "busy" };
    const connection = this.options.connection();
    if (connection.status !== "configured" || !this.options.active())
      return { status: "unavailable" };
    this.#busy = true;
    try {
      const employee = typeof value !== "string" ? value : undefined;
      const url = new URL(
        employee ? `/api/v1/bots/${employee.botId}/export` : `/api/v1/artifacts/${value}/content`,
        connection.serverUrl,
      );
      if (employee) {
        url.searchParams.set("packageId", employee.packageId);
        url.searchParams.set("generatedAt", employee.generatedAt);
      }
      const response = await this.options.fetch(url.href, {
        method: "GET",
        credentials: "include",
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
        headers: employee
          ? {
              Accept:
                "application/vnd.openbot.employee+json, application/vnd.openbot.employee.dsse+json",
              "If-Match": `"${employee.downloadReviewToken}"`,
            }
          : { Accept: "text/markdown, image/png" },
      });
      if (employee && response.status === 412) {
        await response.body?.cancel().catch(() => undefined);
        return { status: "changed" };
      }
      const bytes = employee
        ? await readEmployeeTemplate(response, employee.downloadReviewToken)
        : await readArtifact(response);
      const image = response.headers.get("content-type") === "image/png";
      const disposition = response.headers.get("content-disposition") ?? "";
      if (disposition.length > 1024) return { status: "unavailable" };
      const encodedName = /^attachment; filename="report\.md"; filename\*=UTF-8''([^;]+)$/u.exec(
        disposition,
      )?.[1];
      const employeeName =
        /^attachment; filename="([a-z0-9][a-z0-9-]{0,63}\.openbot-employee(?:\.dsse)?\.json)"$/u.exec(
          disposition,
        )?.[1];
      const name = employee
        ? (employeeName ?? "")
        : image
          ? `screenshot-${value}.png`
          : encodedName
            ? decodeURIComponent(encodedName)
            : "";
      if (
        employee
          ? !employeeName
          : image
            ? disposition !== "inline"
            : !/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,100}\.md$/u.test(name)
      )
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
      if (!isAbsolute(path) || extname(path) !== extname(name) || !sameConnection())
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

async function readArtifact(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing report body.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    const mediaType = response.headers.get("content-type");
    const image = mediaType === "image/png";
    if (response.status !== 200 || (!image && mediaType !== "text/markdown"))
      throw new Error("Invalid report response.");
    const maxBytes = image ? 5 * 1024 * 1024 : 32 * 1024;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > maxBytes) throw new Error("Artifact too large.");
      chunks.push(next.value);
    }
    const bytes = Buffer.concat(chunks);
    if (image) {
      // Saving bytes grants no renderer path authority and never decodes untrusted image content.
      if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        throw new Error("Invalid PNG signature.");
      return bytes;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.trim() || text.includes("\0")) throw new Error("Invalid report text.");
    return bytes;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function isEmployeeTemplateSaveInput(value: unknown): value is EmployeeTemplateSaveInput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;
  return (
    keys.length === 4 &&
    keys.every((key) =>
      ["botId", "packageId", "generatedAt", "downloadReviewToken"].includes(key),
    ) &&
    typeof input.botId === "string" &&
    uuid.test(input.botId) &&
    typeof input.packageId === "string" &&
    uuid.test(input.packageId) &&
    typeof input.generatedAt === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(input.generatedAt) &&
    Number.isFinite(Date.parse(input.generatedAt)) &&
    new Date(input.generatedAt).toISOString() === input.generatedAt &&
    typeof input.downloadReviewToken === "string" &&
    /^[a-f0-9]{64}$/u.test(input.downloadReviewToken)
  );
}

async function readEmployeeTemplate(response: Response, reviewToken: string): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing Employee template body.");
  try {
    if (
      response.status !== 200 ||
      ![
        "application/vnd.openbot.employee+json; charset=utf-8",
        "application/vnd.openbot.employee.dsse+json; charset=utf-8",
      ].includes(response.headers.get("content-type") ?? "") ||
      response.headers.get("etag") !== `"${reviewToken}"`
    )
      throw new Error("Invalid Employee template response.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 2 * 1024 * 1024) throw new Error("Employee template too large.");
      chunks.push(next.value);
    }
    const bytes = Buffer.concat(chunks);
    if (createHash("sha256").update(bytes).digest("hex") !== reviewToken)
      throw new Error("Employee template did not match its reviewed bytes.");
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return bytes;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
