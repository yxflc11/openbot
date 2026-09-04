import { z } from "zod";
import { nodeArchitectureSchema, nodePlatformSchema, protocolVersion } from "./node-metadata.js";

const providerConformanceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);

export const providerConformanceStageSchema = z.enum([
  "declaration",
  "routing",
  "integration",
  "real-device",
]);
export type ProviderConformanceStage = z.infer<typeof providerConformanceStageSchema>;

export const providerConformanceEvidenceLevelSchema = z.enum([
  "simulated",
  "hermetic",
  "real-device",
]);
export type ProviderConformanceEvidenceLevel = z.infer<
  typeof providerConformanceEvidenceLevelSchema
>;

export const providerConformanceCheckStatusSchema = z.enum([
  "success",
  "failure",
  "warning",
  "skipped",
  "info",
]);
export type ProviderConformanceCheckStatus = z.infer<typeof providerConformanceCheckStatusSchema>;

export const providerConformanceCheckSeveritySchema = z.enum([
  "required",
  "recommended",
  "informational",
]);
export type ProviderConformanceCheckSeverity = z.infer<
  typeof providerConformanceCheckSeveritySchema
>;

const providerConformanceHttpsUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => value.startsWith("https://"), "Conformance references must use HTTPS.");

const providerConformanceReferenceSchema = z
  .object({
    id: providerConformanceIdSchema,
    url: providerConformanceHttpsUrlSchema.optional(),
  })
  .strict();

/** A bounded, log-free result for one stable Provider requirement. */
export const providerConformanceCheckSchema = z
  .object({
    id: providerConformanceIdSchema,
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(1000),
    status: providerConformanceCheckStatusSchema,
    severity: providerConformanceCheckSeveritySchema,
    timestamp: z.string().datetime(),
    message: z.string().trim().min(1).max(2000).optional(),
    references: z.array(providerConformanceReferenceSchema).max(16).default([]),
    evidence: z.array(z.string().trim().min(1).max(1024)).max(32).default([]),
  })
  .strict();
export type ProviderConformanceCheck = z.infer<typeof providerConformanceCheckSchema>;

export const providerExpectedFailureSchema = z
  .object({
    checkId: providerConformanceIdSchema,
    reason: z.string().trim().min(1).max(1000),
    issueUrl: providerConformanceHttpsUrlSchema,
    expiresAt: z.string().datetime(),
  })
  .strict();
export type ProviderExpectedFailure = z.infer<typeof providerExpectedFailureSchema>;

const providerConformanceReportCoreSchema = z
  .object({
    format: z.literal("openbot.provider-conformance/v1"),
    generatedAt: z.string().datetime(),
    protocolVersion: z.literal(protocolVersion),
    suite: z
      .object({
        name: providerConformanceIdSchema,
        version: z.string().trim().min(1).max(160),
        stage: providerConformanceStageSchema,
      })
      .strict(),
    provider: z
      .object({
        id: z.string().trim().min(1).max(80),
        displayName: z.string().trim().min(1).max(160),
        version: z.string().trim().min(1).max(160),
        executionStatus: z.enum(["executable", "declaration-only"]),
      })
      .strict(),
    target: z
      .object({
        platform: nodePlatformSchema.refine(
          (platform) => platform !== "unknown",
          "A conformance target must name an operating system.",
        ),
        architecture: nodeArchitectureSchema,
        osVersion: z.string().trim().min(1).max(160),
        evidenceLevel: providerConformanceEvidenceLevelSchema,
      })
      .strict(),
    checks: z.array(providerConformanceCheckSchema).min(1).max(512),
    baseline: z
      .object({
        expectedFailures: z.array(providerExpectedFailureSchema).max(256),
        unexpectedFailures: z.array(providerConformanceIdSchema).max(512),
        staleEntries: z.array(providerConformanceIdSchema).max(256),
      })
      .strict(),
    summary: z
      .object({
        success: z.number().int().min(0).max(512),
        failure: z.number().int().min(0).max(512),
        warning: z.number().int().min(0).max(512),
        skipped: z.number().int().min(0).max(512),
        info: z.number().int().min(0).max(512),
        total: z.number().int().min(1).max(512),
        expectedFailureEntries: z.number().int().min(0).max(256),
        conformant: z.boolean(),
        baselineCurrent: z.boolean(),
      })
      .strict(),
  })
  .strict();

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function sameStrings(left: string[], right: string[]): boolean {
  const sortedLeft = sortedUnique(left);
  const sortedRight = sortedUnique(right);
  return (
    sortedLeft.length === left.length &&
    sortedRight.length === right.length &&
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
}

/**
 * Validate both report shape and computed claims so edited JSON cannot turn failing evidence into a
 * passing summary. An expected failure remains a failure; it only makes a CI baseline current.
 */
export const providerConformanceReportSchema = providerConformanceReportCoreSchema.superRefine(
  (report, context) => {
    const checksById = new Map(report.checks.map((check) => [check.id, check]));
    if (checksById.size !== report.checks.length) {
      context.addIssue({
        code: "custom",
        path: ["checks"],
        message: "Conformance check ids must be unique.",
      });
    }
    for (const [index, check] of report.checks.entries()) {
      if (
        check.severity === "required" &&
        (check.status === "skipped" || check.status === "info")
      ) {
        context.addIssue({
          code: "custom",
          path: ["checks", index, "status"],
          message:
            "A required check must succeed, fail, or warn; missing prerequisites are failures.",
        });
      }
    }

    const expectedIds = report.baseline.expectedFailures.map((entry) => entry.checkId);
    if (new Set(expectedIds).size !== expectedIds.length) {
      context.addIssue({
        code: "custom",
        path: ["baseline", "expectedFailures"],
        message: "Expected-failure check ids must be unique.",
      });
    }

    const generatedAt = Date.parse(report.generatedAt);
    const activeExpected = new Set<string>();
    const staleEntries: string[] = [];
    for (const entry of report.baseline.expectedFailures) {
      const check = checksById.get(entry.checkId);
      const matchesFailure = check?.status === "failure" || check?.status === "warning";
      if (!matchesFailure || Date.parse(entry.expiresAt) <= generatedAt) {
        staleEntries.push(entry.checkId);
      } else {
        activeExpected.add(entry.checkId);
      }
    }

    const nonpassing = report.checks
      .filter(
        (check) =>
          check.status === "failure" ||
          check.status === "warning" ||
          (check.severity === "required" && check.status !== "success"),
      )
      .map((check) => check.id);
    const unexpectedFailures = nonpassing.filter((checkId) => !activeExpected.has(checkId));

    if (!sameStrings(report.baseline.unexpectedFailures, unexpectedFailures)) {
      context.addIssue({
        code: "custom",
        path: ["baseline", "unexpectedFailures"],
        message: "Unexpected failures do not match the check results and active baseline.",
      });
    }
    if (!sameStrings(report.baseline.staleEntries, staleEntries)) {
      context.addIssue({
        code: "custom",
        path: ["baseline", "staleEntries"],
        message: "Stale baseline entries do not match the check results and report time.",
      });
    }

    const counts = {
      success: report.checks.filter((check) => check.status === "success").length,
      failure: report.checks.filter((check) => check.status === "failure").length,
      warning: report.checks.filter((check) => check.status === "warning").length,
      skipped: report.checks.filter((check) => check.status === "skipped").length,
      info: report.checks.filter((check) => check.status === "info").length,
    };
    for (const [status, count] of Object.entries(counts)) {
      if (report.summary[status as keyof typeof counts] !== count) {
        context.addIssue({
          code: "custom",
          path: ["summary", status],
          message: `Expected ${count} ${status} check(s).`,
        });
      }
    }

    const conformant = report.checks
      .filter((check) => check.severity === "required")
      .every((check) => check.status === "success");
    const baselineCurrent = unexpectedFailures.length === 0 && staleEntries.length === 0;
    const exactSummary =
      report.summary.total === report.checks.length &&
      report.summary.expectedFailureEntries === report.baseline.expectedFailures.length &&
      report.summary.conformant === conformant &&
      report.summary.baselineCurrent === baselineCurrent;
    if (!exactSummary) {
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Report summary does not match its checks and expected-failure baseline.",
      });
    }
  },
);
export type ProviderConformanceReport = z.infer<typeof providerConformanceReportSchema>;
