import type { Run, RunOutput } from "@openbot/domain";
import { expect, it } from "vitest";
import { mergeRunOutput } from "./run-output-state";
const run = {
  id: "run",
  channelId: "channel",
  botId: "bot",
  executionProfile: "none",
  status: "running",
} as Run;
const output: RunOutput = {
  runId: run.id,
  channelId: run.channelId,
  botId: run.botId,
  sequence: 3,
  text: "Draft",
  reset: false,
};
it("accepts only forward sequences for the authoritative active native run", () => {
  const initial = new Map<string, RunOutput>();
  const accepted = mergeRunOutput(initial, output, "channel", [run]);
  expect(accepted.get(run.id)).toEqual(output);
  expect(initial.size).toBe(0);
  for (const candidate of [
    { ...output, sequence: 3 },
    { ...output, sequence: 2 },
    { ...output, sequence: -1 },
    { ...output, sequence: 3.5 },
    { ...output, channelId: "other" },
    { ...output, botId: "other" },
    { ...output, runId: "other" },
    { ...output, text: "x".repeat(8001) },
    { ...output, reset: true },
  ])
    expect(mergeRunOutput(accepted, candidate, "channel", [run])).toBe(accepted);
  const reset = mergeRunOutput(
    accepted,
    { ...output, sequence: 4, text: "", reset: true },
    "channel",
    [run],
  );
  expect(reset.get(run.id)?.text).toBe("");
});
it("rejects terminal, cross-channel and worker-host run output", () => {
  const initial = new Map<string, RunOutput>();
  for (const candidate of [
    { ...run, status: "completed" },
    { ...run, status: "cancelled" },
    { ...run, status: "failed" },
    { ...run, channelId: "other" },
    { ...run, executionProfile: "browser" },
  ])
    expect(mergeRunOutput(initial, output, "channel", [candidate as Run])).toBe(initial);
});
