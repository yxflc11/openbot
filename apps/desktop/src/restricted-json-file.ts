import { constants } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import writeFileAtomic from "write-file-atomic";

export interface RestrictedJsonFileOptions<Value> {
  label: string;
  maximumBytes: number;
  parse(input: string): Value;
}

/**
 * Stores public Desktop configuration without turning the renderer or a mutable path into an
 * authority boundary. Callers still own the strict versioned schema.
 */
export class RestrictedJsonFile<Value> {
  readonly #options: RestrictedJsonFileOptions<Value>;
  readonly #path: string;

  constructor(path: string, options: RestrictedJsonFileOptions<Value>) {
    this.#path = resolve(path);
    this.#options = options;
  }

  async load(): Promise<Value | undefined> {
    let pathEntry: Awaited<ReturnType<typeof lstat>>;
    try {
      pathEntry = await lstat(this.#path);
    } catch (error) {
      if (isMissingFile(error)) return undefined;
      throw error;
    }
    if (!pathEntry.isFile() || pathEntry.isSymbolicLink()) {
      throw new Error(`${this.#options.label} path must be a regular file.`);
    }
    if (process.platform !== "win32" && (pathEntry.mode & 0o077) !== 0) {
      throw new Error(`${this.#options.label} has unsafe permissions.`);
    }
    if (pathEntry.size > this.#options.maximumBytes) {
      throw new Error(
        `${this.#options.label} exceeds the ${formatByteLimit(this.#options.maximumBytes)} limit.`,
      );
    }

    const flags =
      process.platform === "win32" ? constants.O_RDONLY : constants.O_RDONLY | constants.O_NOFOLLOW;
    const handle = await open(this.#path, flags);
    try {
      const opened = await handle.stat();
      if (
        !opened.isFile() ||
        opened.dev !== pathEntry.dev ||
        opened.ino !== pathEntry.ino ||
        opened.size > this.#options.maximumBytes
      ) {
        throw new Error(`${this.#options.label} changed while opening.`);
      }
      if (process.platform !== "win32" && (opened.mode & 0o077) !== 0) {
        throw new Error(`${this.#options.label} has unsafe permissions.`);
      }
      return this.#options.parse(await handle.readFile("utf8"));
    } finally {
      await handle.close();
    }
  }

  async save(value: Value): Promise<void> {
    const parsed = this.#options.parse(JSON.stringify(value));
    try {
      const existing = await lstat(this.#path);
      if (!existing.isFile() || existing.isSymbolicLink()) {
        throw new Error(`${this.#options.label} path must be a regular file.`);
      }
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }

    await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
    await writeFileAtomic(this.#path, `${JSON.stringify(parsed)}\n`, { mode: 0o600 });
    const retained = await this.load();
    if (retained === undefined || JSON.stringify(retained) !== JSON.stringify(parsed)) {
      throw new Error(`${this.#options.label} was not retained.`);
    }
  }
}

function formatByteLimit(value: number): string {
  return value % 1024 === 0 ? `${value / 1024} KiB` : `${value} byte`;
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
