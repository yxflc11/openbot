import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger, diagnosticFields } from "./index.js";

describe("OpenBot structured logger", () => {
  it("honors levels and includes allowlisted correlation fields", async () => {
    const destination = new PassThrough();
    const output = collect(destination);
    const logger = createLogger({ destination, level: "info" }).child({ nodeId: "node-1" });

    logger.debug("hidden", "not emitted", { runId: "run-0" });
    logger.info("run.started", "Run started.", { runId: "run-1", phase: "execute" });
    destination.end();

    const records = (await output).trim().split("\n").map(JSON.parse);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      event: "run.started",
      msg: "Run started.",
      nodeId: "node-1",
      runId: "run-1",
      phase: "execute",
    });
  });

  it("redacts known secret keys even below the narrow wrapper", async () => {
    const destination = new PassThrough();
    const output = collect(destination);
    const logger = createLogger({ destination, level: "info" }) as unknown as {
      info(event: string, message: string, fields: { token: string; password: string }): void;
    };

    logger.info("security.test", "Redaction test.", {
      token: "token-value-must-not-appear",
      password: "password-value-must-not-appear",
    });
    destination.end();

    const text = await output;
    expect(text).not.toContain("token-value-must-not-appear");
    expect(text).not.toContain("password-value-must-not-appear");
    expect(text).toContain("[REDACTED]");
  });

  it("keeps arbitrary exception messages and stacks out of diagnostic fields", () => {
    const error = new TypeError("token=secret at /Users/alice/private.txt");
    expect(diagnosticFields(error)).toEqual({ errorName: "TypeError" });
    expect(JSON.stringify(diagnosticFields(error))).not.toContain("secret");
    expect(JSON.stringify(diagnosticFields(error))).not.toContain("/Users/");
  });
});

function collect(stream: PassThrough): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}
