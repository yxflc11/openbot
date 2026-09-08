import { randomUUID } from "node:crypto";
import { modelConnections, runEvents } from "@openbot/db";
import type {
  CreateModelConnectionInput,
  ModelApiProtocol,
  ModelConnection,
  UpdateModelConnectionInput,
} from "@openbot/domain";
import {
  createModelConnectionInputSchema,
  updateModelConnectionInputSchema,
} from "@openbot/protocol";
import { and, asc, count, eq, sql } from "drizzle-orm";
import {
  StoreConflictError,
  StoreNotFoundError,
  StoreValidationError,
} from "./control-plane-store.js";
import type { ModelCredentialCipher } from "./model-credential-cipher.js";

type Database = ReturnType<typeof import("@openbot/db")["createDatabase"]>["db"];
type ConnectionRow = typeof modelConnections.$inferSelect;
const connectionLockNamespace = 0x4d4f444c;
const maximumConnections = 32;

/** Private Server store. Only get() decrypts a credential, after checking that it is enabled. */
export class PostgresModelConnectionStore {
  readonly #database: Database;
  readonly #cipher: ModelCredentialCipher;

  constructor(database: Database, cipher: ModelCredentialCipher) {
    this.#database = database;
    this.#cipher = cipher;
  }

  static async hasAny(database: Database): Promise<boolean> {
    return controlledOperation(async () => {
      const rows = await database
        .select({ id: modelConnections.id })
        .from(modelConnections)
        .limit(1);
      return rows.length > 0;
    });
  }

  async list(): Promise<ModelConnection[]> {
    return controlledOperation(async () => {
      const rows = await this.#database
        .select()
        .from(modelConnections)
        .orderBy(asc(modelConnections.createdAt), asc(modelConnections.id))
        .limit(maximumConnections);
      return rows.map(publicConnection);
    });
  }

  async get(id: string): Promise<{ connection: ModelConnection; apiKey: string } | undefined> {
    return controlledOperation(async () => {
      const [row] = await this.#database
        .select()
        .from(modelConnections)
        .where(eq(modelConnections.id, id))
        .limit(1);
      if (row === undefined) return undefined;
      if (!row.enabled) throw new StoreValidationError("Model connection is disabled.");
      let apiKey: string;
      try {
        apiKey = this.#cipher.decrypt(row.encryptedApiKey, row);
      } catch {
        throw new StoreValidationError(
          "Model connection credential is unavailable. Restore its key or replace the credential.",
        );
      }
      return { connection: publicConnection(row), apiKey };
    });
  }

  async create(
    input: CreateModelConnectionInput & { protocol: ModelApiProtocol },
  ): Promise<ModelConnection> {
    return controlledOperation(async () => {
      const checked = validateCreateInput(input);
      const now = new Date();
      const identity = { id: randomUUID(), presetId: checked.presetId, baseUrl: checked.baseUrl };
      const encryptedApiKey = this.#cipher.encrypt(checked.apiKey, identity);
      return this.#database.transaction(async (transaction) => {
        // A shared transaction lock bounds the entire registry even when Servers create concurrently.
        await transaction.execute(sql`select pg_advisory_xact_lock(${connectionLockNamespace}, 1)`);
        const [total] = await transaction.select({ value: count() }).from(modelConnections);
        if (total === undefined || total.value >= maximumConnections) {
          throw new StoreValidationError("At most 32 saved model connections are allowed.");
        }
        const [row] = await transaction
          .insert(modelConnections)
          .values({
            ...identity,
            name: checked.name,
            protocol: checked.protocol,
            encryptedApiKey,
            enabled: true,
            revision: 1,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (row === undefined) throw new Error("Model connection was not created.");
        await transaction.insert(runEvents).values({
          id: randomUUID(),
          type: "MODEL_CONNECTION_CREATED",
          payload: { id: row.id, presetId: row.presetId, revision: row.revision },
          createdAt: now,
        });
        return publicConnection(row);
      });
    });
  }

  async update(id: string, input: UpdateModelConnectionInput): Promise<ModelConnection> {
    return controlledOperation(async () => {
      const parsed = updateModelConnectionInputSchema.safeParse(input);
      if (!parsed.success) throw new StoreValidationError("Model connection update is invalid.");
      const checked = parsed.data;
      return this.#database.transaction(async (transaction) => {
        const [current] = await transaction
          .select()
          .from(modelConnections)
          .where(eq(modelConnections.id, id))
          .limit(1);
        if (current === undefined) throw new StoreNotFoundError("Model connection not found.");
        if (current.revision !== checked.expectedRevision) throw staleRevision();
        const name = checked.name ?? current.name;
        const enabled = checked.enabled ?? current.enabled;
        const changedFields = [
          ...(name === current.name ? [] : ["name"]),
          ...(checked.apiKey === undefined ? [] : ["apiKey"]),
          ...(enabled === current.enabled ? [] : ["enabled"]),
        ];
        if (changedFields.length === 0) return publicConnection(current);
        const encryptedApiKey =
          checked.apiKey === undefined
            ? current.encryptedApiKey
            : this.#cipher.encrypt(checked.apiKey, current);
        const now = new Date();
        const [updated] = await transaction
          .update(modelConnections)
          .set({
            name,
            enabled,
            encryptedApiKey,
            revision: current.revision + 1,
            updatedAt: now,
          })
          .where(
            and(
              eq(modelConnections.id, id),
              eq(modelConnections.revision, checked.expectedRevision),
            ),
          )
          .returning();
        if (updated === undefined) throw staleRevision();
        await transaction.insert(runEvents).values({
          id: randomUUID(),
          type: "MODEL_CONNECTION_UPDATED",
          payload: { id, presetId: updated.presetId, changedFields, revision: updated.revision },
          createdAt: now,
        });
        return publicConnection(updated);
      });
    });
  }
}

function publicConnection(row: ConnectionRow): ModelConnection {
  return {
    id: row.id,
    name: row.name,
    presetId: row.presetId,
    baseUrl: row.baseUrl,
    protocol: row.protocol as ModelApiProtocol,
    enabled: row.enabled,
    hasApiKey: row.encryptedApiKey.length > 0,
    revision: row.revision,
    source: "saved",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validateCreateInput(
  input: CreateModelConnectionInput & { protocol: ModelApiProtocol },
): CreateModelConnectionInput & { protocol: ModelApiProtocol } {
  const { protocol, ...properties } = input;
  const parsed = createModelConnectionInputSchema.safeParse(properties);
  if (!parsed.success || !["openai-chat", "anthropic-messages"].includes(protocol)) {
    throw new StoreValidationError("Model connection input is invalid.");
  }
  return { ...parsed.data, protocol };
}

async function controlledOperation<Value>(operation: () => Promise<Value>): Promise<Value> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof StoreConflictError ||
      error instanceof StoreNotFoundError ||
      error instanceof StoreValidationError
    )
      throw error;
    // Database diagnostics include bound parameters. They must never reach API errors or logs.
    throw new Error("Model connection operation failed.");
  }
}

function staleRevision(): StoreConflictError {
  return new StoreConflictError("Model connection changed. Reload before saving again.");
}
