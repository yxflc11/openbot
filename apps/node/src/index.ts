import { nodeEnvSchema } from "@openbot/config";
import { startNodeRuntime } from "./runtime.js";

const env = nodeEnvSchema.parse(process.env);
startNodeRuntime(env);
