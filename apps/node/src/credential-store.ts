import { constants } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { type NodeEnrollmentResult, nodeEnrollmentResultSchema } from "@openbot/protocol";
import writeFileAtomic from "write-file-atomic";

const maximumCredentialFileBytes = 4 * 1024;

export interface NodeCredentialStore {
  load(nodeId: string): Promise<NodeEnrollmentResult | undefined>;
  save(identity: NodeEnrollmentResult): Promise<void>;
}

/** Baseline cross-platform store; native OS keyrings remain a replaceable production adapter. */
export class FileNodeCredentialStore implements NodeCredentialStore {
  readonly #path: string;

  constructor(path: string) {
    this.#path = resolve(path);
  }

  async load(nodeId: string): Promise<NodeEnrollmentResult | undefined> {
    try {
      const pathEntry = await lstat(this.#path);
      if (!pathEntry.isFile() || pathEntry.isSymbolicLink()) {
        throw new Error("Node credential path must be a regular file.");
      }
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw error;
    }

    const handle = await open(
      this.#path,
      process.platform === "win32" ? constants.O_RDONLY : constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const file = await handle.stat();
      if (!file.isFile()) throw new Error("Node credential path must be a regular file.");
      if (process.platform !== "win32" && (file.mode & 0o077) !== 0) {
        throw new Error("Node credential file must not be accessible by group or other users.");
      }
      if (file.size > maximumCredentialFileBytes) {
        throw new Error("Node credential file exceeds the 4 KiB limit.");
      }

      const parsed = nodeEnrollmentResultSchema.safeParse(
        JSON.parse(await handle.readFile("utf8")),
      );
      if (!parsed.success) throw new Error("Node credential file is invalid.");
      if (parsed.data.nodeId !== nodeId) {
        throw new Error("Node credential belongs to a different Node id.");
      }
      return parsed.data;
    } finally {
      await handle.close();
    }
  }

  async save(identity: NodeEnrollmentResult): Promise<void> {
    const parsed = nodeEnrollmentResultSchema.parse(identity);
    await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
    await writeFileAtomic(this.#path, `${JSON.stringify(parsed)}\n`, { mode: 0o600 });
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
