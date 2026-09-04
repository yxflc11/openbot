import { loadMacOSNodeServiceEnvironment } from "./macos-service-config.js";
import { startNodeRuntime } from "./runtime.js";

if (process.argv.length !== 2) {
  throw new Error("The macOS Node service does not accept arguments.");
}

startNodeRuntime(await loadMacOSNodeServiceEnvironment());
