import { nodeEnvSchema } from "@openbot/config";
import { OpenBotNodeClient } from "./client.js";

const env = nodeEnvSchema.parse(process.env);
const client = new OpenBotNodeClient(env);
client.start();

process.once("SIGINT", () => client.stop());
process.once("SIGTERM", () => client.stop());
