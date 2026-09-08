import { modelProviderIds } from "@openbot/domain";
import type { RunModelUsage } from "@openbot/domain";
import type { LanguageModelUsage } from "ai";
import { z } from "zod";

export const runModelUsageSchema = z
  .object({
    provider: z.enum(modelProviderIds),
    model: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*(?:\/[A-Za-z0-9][A-Za-z0-9._:-]*)?$/u),
    steps: z.number().int().min(1).max(5),
    inputTokens: z.number().int().min(0).max(1_000_000_000).nullable(),
    outputTokens: z.number().int().min(0).max(1_000_000_000).nullable(),
  })
  .strict();

export function addReportedUsage(
  previous: RunModelUsage | undefined,
  step: LanguageModelUsage,
  identity: Pick<RunModelUsage, "provider" | "model">,
): RunModelUsage {
  const sum = (value: number | undefined, prior: number | null | undefined) => {
    if (
      value === undefined ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > 1_000_000_000 ||
      prior === null
    )
      return null;
    const total = (prior ?? 0) + value;
    return total <= 1_000_000_000 ? total : null;
  };
  return runModelUsageSchema.parse({
    ...identity,
    steps: (previous?.steps ?? 0) + 1,
    inputTokens: sum(step.inputTokens, previous?.inputTokens),
    outputTokens: sum(step.outputTokens, previous?.outputTokens),
  });
}

export const nativeFailureMessages = {
  model_credentials:
    "Model credentials were rejected. Verify the provider key in Settings before submitting a new task.",
  model_rate_limit: "The model provider rate limit was reached. Wait before submitting a new task.",
  model_unavailable:
    "The model provider is unavailable. Check the configured model and service status.",
  settings_changed:
    "Model settings changed during this task. Review the current configuration and submit a new task.",
  scope_revoked: "This Bot no longer has access to the task channel. Check its membership.",
  task_limit: "The task exceeded its execution limits. Split it into smaller tasks.",
  tool_unavailable:
    "A scoped tool could not complete. Check the task URLs and requested capability.",
  task_timeout:
    "The task reached its time limit. Try a smaller task or check the provider connection.",
  server_interrupted: "The Server interrupted this task. Submit a new task when it is ready.",
  execution_failed:
    "The Agent could not complete. Check model settings, channel access and task scope before submitting a new task.",
} as const;
export type NativeFailureCode = keyof typeof nativeFailureMessages;
export class NativeExecutionError extends Error {
  constructor(readonly code: NativeFailureCode) {
    super(nativeFailureMessages[code]);
  }
}
