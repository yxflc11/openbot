import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { Artifact } from "@openbot/domain";
import type { CompletedArtifact } from "@openbot/protocol";

const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface PersistedArtifact {
  artifact: Artifact;
  storageKey: string;
  metadata: Record<string, unknown>;
}

export interface ArtifactStorage {
  persist(runId: string, inputs: CompletedArtifact[]): Promise<PersistedArtifact[]>;
  read(storageKey: string): Promise<Buffer>;
  remove(storageKeys: string[]): Promise<void>;
}

export class FileArtifactStorage implements ArtifactStorage {
  readonly #root: string;

  constructor(root: string) {
    this.#root = resolve(root);
  }

  async persist(runId: string, inputs: CompletedArtifact[]): Promise<PersistedArtifact[]> {
    const persisted: PersistedArtifact[] = [];
    try {
      for (const input of inputs) {
        const bytes = decodePng(input.base64);
        const id = randomUUID();
        const storageKey = `runs/${runId}/${id}.png`;
        const destination = this.#pathFor(storageKey);
        const temporary = `${destination}.${randomUUID()}.tmp`;
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
        await rename(temporary, destination);
        persisted.push({
          artifact: {
            id,
            runId,
            name: input.name,
            mediaType: input.mediaType,
            sha256: createHash("sha256").update(bytes).digest("hex"),
            sizeBytes: bytes.byteLength,
            createdAt: new Date().toISOString(),
          },
          storageKey,
          metadata: { ...(input.metadata ?? {}), sizeBytes: bytes.byteLength },
        });
      }
      return persisted;
    } catch (error) {
      await this.remove(persisted.map((item) => item.storageKey));
      throw error;
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.#pathFor(storageKey));
  }

  async remove(storageKeys: string[]): Promise<void> {
    await Promise.all(
      storageKeys.map(async (storageKey) => {
        try {
          await rm(this.#pathFor(storageKey), { force: true });
        } catch {
          // Rollback cleanup is best-effort; the persistence failure remains the primary error.
        }
      }),
    );
  }

  #pathFor(storageKey: string): string {
    if (!/^runs\/[0-9a-f-]+\/[0-9a-f-]+\.png$/i.test(storageKey)) {
      throw new Error("Invalid artifact storage key.");
    }
    const path = resolve(this.#root, storageKey);
    if (!path.startsWith(`${this.#root}${sep}`)) throw new Error("Artifact path escaped its root.");
    return path;
  }
}

function decodePng(base64: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error("Artifact image data is not valid base64.");
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ARTIFACT_BYTES) {
    throw new Error("Artifact exceeds the 5 MiB limit.");
  }
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("Only PNG screenshot artifacts are accepted.");
  }
  return bytes;
}
