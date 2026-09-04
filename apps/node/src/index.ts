import { nodeEnvSchema } from "@openbot/config";
import { createLogger, diagnosticFields } from "@openbot/logging";
import { OpenBotNodeClient } from "./client.js";
import { attachNodeServiceControl, nodeServiceControlMode } from "./service-control.js";

const env = nodeEnvSchema.parse(process.env);
const logger = createLogger({ level: env.OPENBOT_LOG_LEVEL });
const client = new OpenBotNodeClient(
  env,
  undefined,
  undefined,
  logger,
);
let shutdownPromise: Promise<void> | undefined;
let detachServiceControl: (() => void) | undefined;

function requestShutdown(exitCode: 0 | 1): Promise<void> {
  if (exitCode !== 0) process.exitCode = 1;
  if (shutdownPromise !== undefined) return shutdownPromise;
  detachServiceControl?.();
  shutdownPromise = client.stop().catch((error: unknown) => {
    process.exitCode = 1;
    logger.error("node.shutdown_failed", "Node shutdown failed.", {
      nodeId: env.OPENBOT_NODE_ID,
      phase: "shutdown",
      ...diagnosticFields(error),
    });
  });
  return shutdownPromise;
}

if (env.OPENBOT_NODE_SERVICE_CONTROL === nodeServiceControlMode) {
  detachServiceControl = attachNodeServiceControl(process.stdin, (exitCode) => {
    void requestShutdown(exitCode);
  });
}

void client.start().catch(() => requestShutdown(1));

process.once("SIGINT", () => void requestShutdown(0));
process.once("SIGTERM", () => void requestShutdown(0));
