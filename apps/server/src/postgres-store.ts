import { randomUUID } from "node:crypto";
import type { Bot, Channel, CreateBotInput, CreateChannelInput } from "@openbot/domain";
import { bots, channelBots, channels, runEvents, runs } from "@openbot/db";
import { count, desc, eq, inArray } from "drizzle-orm";
import type { ControlPlaneStore, PersistedCounts } from "./control-plane-store.js";
import {
  StoreConflictError,
  StoreNotFoundError,
  StoreValidationError,
} from "./control-plane-store.js";

type Database = ReturnType<typeof import("@openbot/db")["createDatabase"]>["db"];

const activeRunStatuses = ["queued", "running", "waiting_approval", "blocked"];

export class PostgresControlPlaneStore implements ControlPlaneStore {
  readonly #db: Database;

  constructor(database: Database) {
    this.#db = database;
  }

  async listChannels(): Promise<Channel[]> {
    const rows = await this.#db
      .select({
        id: channels.id,
        name: channels.name,
        description: channels.description,
        createdAt: channels.createdAt,
        botId: channelBots.botId,
      })
      .from(channels)
      .leftJoin(channelBots, eq(channelBots.channelId, channels.id))
      .orderBy(desc(channels.createdAt));

    const result = new Map<string, Channel>();
    for (const row of rows) {
      const channel = result.get(row.id) ?? {
        id: row.id,
        name: row.name,
        description: row.description,
        botIds: [],
        createdAt: row.createdAt.toISOString(),
      };
      if (row.botId !== null) {
        channel.botIds.push(row.botId);
      }
      result.set(row.id, channel);
    }
    return Array.from(result.values());
  }

  async listBots(): Promise<Bot[]> {
    const rows = await this.#db.select().from(bots).orderBy(desc(bots.createdAt));
    return rows.map(toBot);
  }

  async getCounts(): Promise<PersistedCounts> {
    const [channelCount, botCount, activeRunCount] = await Promise.all([
      this.#db.select({ value: count() }).from(channels),
      this.#db.select({ value: count() }).from(bots),
      this.#db.select({ value: count() }).from(runs).where(inArray(runs.status, activeRunStatuses)),
    ]);
    return {
      channels: channelCount[0]?.value ?? 0,
      bots: botCount[0]?.value ?? 0,
      activeRuns: activeRunCount[0]?.value ?? 0,
    };
  }

  async createBot(input: CreateBotInput): Promise<Bot> {
    const now = new Date();
    const bot = {
      id: randomUUID(),
      name: input.name,
      role: input.role,
      status: "idle" as const,
      computerProfile: input.computerProfile,
      configuration: {},
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.#db.transaction(async (transaction) => {
        await transaction.insert(bots).values(bot);
        await transaction.insert(runEvents).values({
          id: randomUUID(),
          botId: bot.id,
          type: "BOT_CREATED",
          payload: { name: bot.name, role: bot.role },
        });
      });
    } catch (error) {
      translateDatabaseError(error, `A Bot named “${input.name}” already exists.`);
    }

    return toBot(bot);
  }

  async createChannel(input: CreateChannelInput): Promise<Channel> {
    const channelId = randomUUID();
    const now = new Date();

    try {
      await this.#db.transaction(async (transaction) => {
        if (input.botIds.length > 0) {
          const existingBots = await transaction
            .select({ id: bots.id })
            .from(bots)
            .where(inArray(bots.id, input.botIds));
          if (existingBots.length !== input.botIds.length) {
            throw new StoreValidationError("One or more selected Bots no longer exist.");
          }
        }

        await transaction.insert(channels).values({
          id: channelId,
          name: input.name,
          description: input.description,
          createdAt: now,
          updatedAt: now,
        });
        if (input.botIds.length > 0) {
          await transaction.insert(channelBots).values(
            input.botIds.map((botId) => ({
              channelId,
              botId,
              joinedAt: now,
            })),
          );
        }
        await transaction.insert(runEvents).values([
          {
            id: randomUUID(),
            channelId,
            type: "CHANNEL_CREATED",
            payload: { name: input.name },
          },
          ...input.botIds.map((botId) => ({
            id: randomUUID(),
            channelId,
            botId,
            type: "BOT_JOINED_CHANNEL",
            payload: {},
          })),
        ]);
      });
    } catch (error) {
      if (error instanceof StoreValidationError) {
        throw error;
      }
      translateDatabaseError(error, `A channel named “${input.name}” already exists.`);
    }

    return {
      id: channelId,
      name: input.name,
      description: input.description,
      botIds: input.botIds,
      createdAt: now.toISOString(),
    };
  }

  async joinBotToChannel(channelId: string, botId: string): Promise<Channel> {
    try {
      await this.#db.transaction(async (transaction) => {
        const [channelRows, botRows] = await Promise.all([
          transaction.select({ id: channels.id }).from(channels).where(eq(channels.id, channelId)),
          transaction.select({ id: bots.id }).from(bots).where(eq(bots.id, botId)),
        ]);
        if (channelRows.length === 0) {
          throw new StoreNotFoundError("Channel not found.");
        }
        if (botRows.length === 0) {
          throw new StoreNotFoundError("Bot not found.");
        }

        const inserted = await transaction
          .insert(channelBots)
          .values({ channelId, botId })
          .onConflictDoNothing()
          .returning({ botId: channelBots.botId });
        if (inserted.length > 0) {
          await transaction.insert(runEvents).values({
            id: randomUUID(),
            channelId,
            botId,
            type: "BOT_JOINED_CHANNEL",
            payload: {},
          });
        }
      });
    } catch (error) {
      if (error instanceof StoreNotFoundError) {
        throw error;
      }
      throw error;
    }

    const channel = (await this.listChannels()).find((item) => item.id === channelId);
    if (channel === undefined) {
      throw new StoreNotFoundError("Channel not found.");
    }
    return channel;
  }
}

function toBot(row: typeof bots.$inferSelect | typeof bots.$inferInsert): Bot {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    status: row.status as Bot["status"],
    computerProfile: row.computerProfile as Bot["computerProfile"],
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

function translateDatabaseError(error: unknown, conflictMessage: string): never {
  if (hasDatabaseCode(error, "23505")) {
    throw new StoreConflictError(conflictMessage);
  }
  throw error;
}

function hasDatabaseCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  if ("code" in error && error.code === code) {
    return true;
  }
  return "cause" in error && hasDatabaseCode(error.cause, code);
}
