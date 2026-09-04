#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runProviderConformanceSuite, type ProviderConformanceSuite } from "./runner.js";
import { writeNewProviderConformanceReport } from "./output.js";

interface CliArguments {
  modulePath: string;
  outputPath: string;
}

function parseArguments(argv: string[]): CliArguments {
  if (argv.length !== 4 || argv[0] !== "--module" || argv[2] !== "--output") {
    throw new Error("Invalid arguments.");
  }
  const modulePath = argv[1];
  const outputPath = argv[3];
  if (
    modulePath === undefined ||
    modulePath.length === 0 ||
    outputPath === undefined ||
    outputPath.length === 0
  ) {
    throw new Error("Invalid arguments.");
  }
  return { modulePath: resolve(modulePath), outputPath: resolve(outputPath) };
}

async function main(): Promise<0 | 1> {
  const { modulePath, outputPath } = parseArguments(process.argv.slice(2));
  const loaded: unknown = await import(pathToFileURL(modulePath).href);
  if (typeof loaded !== "object" || loaded === null || !("suite" in loaded)) {
    throw new Error("Scenario module is invalid.");
  }
  const suite = Reflect.get(loaded, "suite") as ProviderConformanceSuite;
  const result = await runProviderConformanceSuite(suite);
  await writeNewProviderConformanceReport(outputPath, result.report);
  console.info("Provider conformance report written.");
  return result.exitCode;
}

try {
  process.exitCode = await main();
} catch {
  console.error("Provider conformance runner failed.");
  process.exitCode = 2;
}
