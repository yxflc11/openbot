import { z } from "zod";

const portSchema = z.coerce.number().int().positive().max(65_535);

export const serverEnvSchema = z.object({
  OPENBOT_HOST: z.string().default("0.0.0.0"),
  OPENBOT_PORT: portSchema.default(3001),
  OPENBOT_DATABASE_URL: z.string().default("postgres://openbot:openbot@localhost:5432/openbot"),
  OPENBOT_NODE_TOKEN: z.string().min(1),
  OPENBOT_OBJECT_STORE_PATH: z.string().default("./data/objects"),
  OPENBOT_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const nodeEnvSchema = z.object({
  OPENBOT_NODE_ID: z.string().min(1),
  OPENBOT_NODE_SERVER_URL: z.string().url().default("ws://localhost:3001/ws/nodes"),
  OPENBOT_NODE_TOKEN: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type NodeEnv = z.infer<typeof nodeEnvSchema>;
