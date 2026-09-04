import type { Readable } from "node:stream";
import type { NodeEnv } from "@openbot/config";
import { createLogger, diagnosticFields } from "@openbot/logging";
import { OpenBotNodeClient } from "./client.js";
import { MacOSHostNodeCredentialStore, type NodeCredentialStore } from "./credential-store.js";
import {
  attachMacOSNodeServiceControl,
  attachNodeServiceControl,
  nodeServiceControlMode,
} from "./service-control.js";

export const macOSNodeServiceControlMode = "stdio-v3" as const;

export function startNodeRuntime(env: NodeEnv, input: Readable = process.stdin): void {
  const logger = createLogger({ level: env.OPENBOT_LOG_LEVEL });
  let client: OpenBotNodeClient | undefined;
  let shutdownPromise: Promise<void> | undefined;
  let detachServiceControl: (() => void) | undefined;

  function requestShutdown(exitCode: 0 | 1): Promise<void> {
    if (exitCode !== 0) process.exitCode = 1;
    if (shutdownPromise !== undefined) return shutdownPromise;
    detachServiceControl?.();
    shutdownPromise = (client?.stop() ?? Promise.resolve()).catch((error: unknown) => {
      process.exitCode = 1;
      logger.error("node.shutdown_failed", "Node shutdown failed.", {
        nodeId: env.OPENBOT_NODE_ID,
        phase: "shutdown",
        ...diagnosticFields(error),
      });
    });
    return shutdownPromise;
  }

  function startClient(credentialStore?: NodeCredentialStore): void {
    if (client !== undefined || shutdownPromise !== undefined) {
      void requestShutdown(1);
      return;
    }
    try {
      client = new OpenBotNodeClient(env, undefined, credentialStore, logger);
      void client.start().catch(() => requestShutdown(1));
    } catch {
      void requestShutdown(1);
    }
  }

  if (env.OPENBOT_NODE_SERVICE_CONTROL === macOSNodeServiceControlMode) {
    if (process.platform !== "darwin") {
      void requestShutdown(1);
    } else {
      detachServiceControl = attachMacOSNodeServiceControl(input, env.OPENBOT_NODE_ID, {
        start: (identity) =>
          startClient(new MacOSHostNodeCredentialStore(identity, { platform: "darwin" })),
        shutdown: (exitCode) => {
          void requestShutdown(exitCode);
        },
      });
    }
  } else if (env.OPENBOT_NODE_SERVICE_CONTROL === nodeServiceControlMode) {
    detachServiceControl = attachNodeServiceControl(input, {
      start: () => startClient(),
      shutdown: (exitCode) => {
        void requestShutdown(exitCode);
      },
    });
  } else {
    startClient();
  }

  process.once("SIGINT", () => void requestShutdown(0));
  process.once("SIGTERM", () => void requestShutdown(0));
}
