import { nodeEnvSchema } from "@openbot/config";
import { createLogger } from "@openbot/logging";
import { OpenBotNodeClient } from "./client.js";

const env = nodeEnvSchema.parse(process.env);
const client = new OpenBotNodeClient(
  env,
  undefined,
  undefined,
  createLogger({ level: env.OPENBOT_LOG_LEVEL }),
);
client.start();

process.once("SIGINT", () => client.stop());
process.once("SIGTERM", () => client.stop());
