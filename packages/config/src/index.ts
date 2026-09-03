import { z } from "zod";

const portSchema = z.coerce.number().int().positive().max(65_535);
const booleanSchema = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

export const serverEnvSchema = z.object({
  OPENBOT_HOST: z.string().default("0.0.0.0"),
  OPENBOT_PORT: portSchema.default(3001),
  OPENBOT_DATABASE_URL: z.string().default("postgres://openbot:openbot@localhost:5432/openbot"),
  OPENBOT_NODE_TOKEN: z.string().min(1),
  OPENBOT_OWNER_NAME: z.string().trim().min(1).max(80).default("Owner"),
  OPENBOT_OWNER_PASSWORD: z
    .string()
    .min(12)
    .refine(
      (value) => value !== "replace-with-a-long-random-owner-password",
      "Replace the example owner password before starting OpenBot.",
    ),
  OPENBOT_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  OPENBOT_SECURE_COOKIES: booleanSchema,
  OPENBOT_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://127.0.0.1:5173")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1)),
  OPENBOT_OBJECT_STORE_PATH: z.string().default("./data/objects"),
  OPENBOT_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const nodeEnvSchema = z
  .object({
    OPENBOT_NODE_ID: z.string().min(1),
    OPENBOT_NODE_SERVER_URL: z.string().url().default("ws://localhost:3001/ws/nodes"),
    OPENBOT_NODE_TOKEN: z.string().min(1),
    OPENBOT_NODE_MAX_CONCURRENT_RUNS: z.coerce.number().int().min(1).max(16).default(1),
    OPENBOT_NODE_WORK_DIRECTORY: z.string().default("./data/node"),
    OPENBOT_DOCKER_COMPUTER_URL: z.string().url().optional(),
    OPENBOT_DOCKER_COMPUTER_TOKEN: z.string().min(16).optional(),
    OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS: booleanSchema,
  })
  .superRefine((value, context) => {
    if (
      (value.OPENBOT_DOCKER_COMPUTER_URL === undefined) !==
      (value.OPENBOT_DOCKER_COMPUTER_TOKEN === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "OPENBOT_DOCKER_COMPUTER_URL and OPENBOT_DOCKER_COMPUTER_TOKEN must be set together.",
        path: ["OPENBOT_DOCKER_COMPUTER_URL"],
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type NodeEnv = z.infer<typeof nodeEnvSchema>;
