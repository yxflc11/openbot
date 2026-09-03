import { createHash, randomUUID } from "node:crypto";
import type {
  EmployeeExportFinding,
  EmployeeExportPreview,
  EmployeeImportIssue,
  EmployeeImportPreview,
  EmployeeProfile,
  ExecutionNode,
} from "@openbot/domain";
import {
  employeeTemplatePayloadSchema,
  type EmployeeTemplatePackage,
  type EmployeeTemplatePayload,
} from "@openbot/protocol";
import { requirementsForExecutionProfile } from "./execution-routing.js";

interface EmployeeTemplateBuildOptions {
  generatedAt?: string;
  packageId?: string;
}

export interface EmployeeTemplateBuild {
  document: EmployeeTemplatePackage;
  preview: EmployeeExportPreview;
}

const sensitivePatterns: ReadonlyArray<{
  code: EmployeeExportFinding["code"];
  expression: RegExp;
  message: string;
}> = [
  {
    code: "private-key-content",
    expression: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    message: "A private-key marker was found. Remove it before exporting.",
  },
  {
    code: "credential-like-content",
    expression: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bgh[pousr]_[A-Za-z0-9_]{20,}\b/i,
    message: "A credential-like token was found. Remove it before exporting.",
  },
  {
    code: "credential-like-content",
    expression:
      /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|secret|session(?:id|_token)?)\s*[:=]\s*["']?[^\s"',;]{6,}/i,
    message: "A credential-like assignment was found. Remove it before exporting.",
  },
  {
    code: "credential-like-content",
    expression: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
    message: "A bearer token was found. Remove it before exporting.",
  },
  {
    code: "local-path-content",
    expression: /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/,
    message: "A user-specific local path was found. Replace it with a portable path.",
  },
];

/**
 * Builds the safe, identity-free v1 template. The generated package is checksum protected but is
 * deliberately marked unsigned until OpenBot has an owner key lifecycle.
 */
export function buildEmployeeTemplate(
  profile: EmployeeProfile,
  options: EmployeeTemplateBuildOptions = {},
): EmployeeTemplateBuild {
  const exportedSkills = profile.skills
    .filter((skill) => skill.state === "verified")
    .sort((left, right) => left.slug.localeCompare(right.slug));
  const exportedSkillSlugs = new Map(exportedSkills.map((skill) => [skill.id, skill.slug]));
  const requestedCapabilities = Array.from(
    new Set(exportedSkills.flatMap((skill) => skill.requiredCapabilities)),
  ).sort();

  const payload = employeeTemplatePayloadSchema.parse({
    format: "openbot.employee/v1",
    kind: "template",
    packageId: options.packageId ?? randomUUID(),
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    employee: {
      name: profile.employee.name,
      role: profile.employee.role,
      ...(profile.employee.appearance ? { appearance: profile.employee.appearance } : {}),
    },
    configuration: {
      recommendedExecutionProfile: profile.configuration.executionProfile,
    },
    skills: exportedSkills.map((skill) => ({
      slug: skill.slug,
      name: skill.name,
      description: skill.description,
      version: skill.version,
      requiredCapabilities: [...new Set(skill.requiredCapabilities)].sort(),
      dependencySlugs: skill.dependencyIds
        .flatMap((dependencyId) => {
          const slug = exportedSkillSlugs.get(dependencyId);
          return slug === undefined ? [] : [slug];
        })
        .sort(),
    })),
    requestedCapabilities,
    portability: {
      identity: "new-on-import",
      authority: "none",
      memories: "none",
      importedSkillState: "disabled-pending-review",
    },
    signature: { status: "unsigned" },
  });

  const checksum = createHash("sha256").update(canonicalJson(payload)).digest("hex");
  const findings = scanPortableFields(payload);
  const workHistoryCount =
    profile.evolution.length +
    profile.records.runs.length +
    profile.records.approvals.length +
    profile.records.artifacts.length +
    profile.records.decisions.length;
  const document: EmployeeTemplatePackage = {
    payload,
    integrity: {
      algorithm: "sha256",
      canonicalization: "openbot-json-v1",
      digest: checksum,
    },
  };

  return {
    document,
    preview: {
      format: payload.format,
      kind: payload.kind,
      fileName: `${portableFileStem(profile.employee.name)}.openbot-employee.json`,
      generatedAt: payload.generatedAt,
      employeeName: payload.employee.name,
      verifiedSkillCount: payload.skills.length,
      requestedCapabilities,
      includedMemoryCount: 0,
      exclusions: [
        {
          category: "identity",
          count: 1,
          reason: "The source employee id and ownership are never included in a template.",
        },
        {
          category: "authority",
          count: 1,
          reason: "Host bindings, approvals, credentials, sessions, and capability grants are absent.",
        },
        {
          category: "memory",
          count: profile.memories.length,
          reason: "The v1 default template exports no memory records.",
        },
        {
          category: "work-history",
          count: workHistoryCount,
          reason: "Runs, decisions, artifacts, approvals, and evolution history stay on the source Server.",
        },
      ],
      findings,
      blocked: findings.length > 0,
      checksum,
      signatureStatus: "unsigned",
      identityOnImport: "new",
      hostAuthority: "none",
    },
  };
}

export function serializeEmployeeTemplate(document: EmployeeTemplatePackage): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function verifyEmployeeTemplateChecksum(document: EmployeeTemplatePackage): boolean {
  const actual = createHash("sha256").update(canonicalJson(document.payload)).digest("hex");
  return actual === document.integrity.digest;
}

/**
 * Inspects a schema-valid package in quarantine. This function never persists or activates data.
 */
export function inspectEmployeeTemplate(
  document: EmployeeTemplatePackage,
  nodes: ExecutionNode[],
): EmployeeImportPreview {
  const { payload } = document;
  const issues: EmployeeImportIssue[] = [];
  const skillSlugs = payload.skills.map((skill) => skill.slug);
  const uniqueSkillSlugs = new Set(skillSlugs);
  const duplicateSkillSlugs = Array.from(
    new Set(skillSlugs.filter((slug, index) => skillSlugs.indexOf(slug) !== index)),
  ).sort();
  if (duplicateSkillSlugs.length > 0) {
    issues.push({
      code: "duplicate-skill",
      message: "The package contains duplicate skill slugs.",
      locations: duplicateSkillSlugs,
    });
  }

  const missingDependencies = payload.skills.flatMap((skill) =>
    skill.dependencySlugs
      .filter((dependencySlug) => !uniqueSkillSlugs.has(dependencySlug))
      .map((dependencySlug) => `${skill.slug} -> ${dependencySlug}`),
  );
  if (missingDependencies.length > 0) {
    issues.push({
      code: "missing-skill-dependency",
      message: "One or more skill dependencies are absent from the package.",
      locations: [...new Set(missingDependencies)].sort(),
    });
  }

  const skillCapabilities = Array.from(
    new Set(payload.skills.flatMap((skill) => skill.requiredCapabilities)),
  ).sort();
  const declaredCapabilities = [...new Set(payload.requestedCapabilities)].sort();
  if (skillCapabilities.join("\n") !== declaredCapabilities.join("\n")) {
    issues.push({
      code: "capability-set-mismatch",
      message: "The declared capability set does not match the included skills.",
      locations: Array.from(new Set([...skillCapabilities, ...declaredCapabilities])).sort(),
    });
  }

  if (!verifyEmployeeTemplateChecksum(document)) {
    issues.push({
      code: "checksum-mismatch",
      message: "The package checksum does not match its payload.",
      locations: ["integrity.digest"],
    });
  }

  const sensitiveFindings = scanPortableFields(payload);
  if (sensitiveFindings.length > 0) {
    issues.push({
      code: "sensitive-content",
      message: "The package contains credential-like text or a machine-local path.",
      locations: sensitiveFindings.map((finding) => finding.location),
    });
  }

  const executionRequirements = requirementsForExecutionProfile(
    payload.configuration.recommendedExecutionProfile,
  );
  const requiredForCompatibility = Array.from(
    new Set([
      ...skillCapabilities,
      ...declaredCapabilities,
      ...(executionRequirements?.capabilities ?? []),
    ]),
  ).sort();
  const hostRequired =
    payload.configuration.recommendedExecutionProfile !== "none" ||
    requiredForCompatibility.length > 0;
  const availableCapabilities = new Set(
    nodes.flatMap((node) => [
      ...node.capabilities,
      ...node.capabilityManifest.map((capability) => capability.id),
    ]),
  );
  const missingCapabilities = requiredForCompatibility.filter(
    (capability) => !availableCapabilities.has(capability),
  );
  const compatibleHosts = hostRequired
    ? nodes
        .filter((node) => {
          if (
            executionRequirements?.platform !== undefined &&
            node.platform !== executionRequirements.platform
          ) {
            return false;
          }
          const nodeCapabilities = new Set([
            ...node.capabilities,
            ...node.capabilityManifest.map((capability) => capability.id),
          ]);
          return requiredForCompatibility.every((capability) => nodeCapabilities.has(capability));
        })
        .map(({ id, name, platform, architecture, deviceClass }) => ({
          id,
          name,
          platform,
          architecture,
          deviceClass,
        }))
        .sort((left, right) => left.id.localeCompare(right.id))
    : [];

  if (missingCapabilities.length > 0) {
    issues.push({
      code: "missing-capability",
      message: "No connected Worker Host currently advertises one or more required capabilities.",
      locations: missingCapabilities,
    });
  }
  if (hostRequired && compatibleHosts.length === 0) {
    issues.push({
      code: "no-compatible-host",
      message: "No connected Worker Host satisfies the complete package requirement set.",
      locations: [payload.configuration.recommendedExecutionProfile],
    });
  }

  return {
    format: payload.format,
    packageId: payload.packageId,
    generatedAt: payload.generatedAt,
    employee: payload.employee,
    recommendedExecutionProfile: payload.configuration.recommendedExecutionProfile,
    skills: payload.skills.map(
      ({ slug, name, version, requiredCapabilities, dependencySlugs }) => ({
        slug,
        name,
        version,
        requiredCapabilities,
        dependencySlugs,
      }),
    ),
    requestedCapabilities: declaredCapabilities,
    integrity: { algorithm: "sha256", valid: verifyEmployeeTemplateChecksum(document) },
    signature: { status: "unsigned", trusted: false },
    compatibility: {
      hostRequired,
      compatibleHosts,
      missingCapabilities,
    },
    quarantine: {
      active: true,
      createsNewIdentity: true,
      importedSkillState: "disabled-pending-review",
      hostAuthority: "none",
      memoryCount: 0,
      canActivate: false,
    },
    issues,
    blocked: issues.length > 0,
  };
}

function scanPortableFields(payload: EmployeeTemplatePayload): EmployeeExportFinding[] {
  const fields = [
    { location: "employee.name", value: payload.employee.name },
    { location: "employee.role", value: payload.employee.role },
    ...payload.skills.flatMap((skill, index) => [
      { location: `skills[${index}].slug`, value: skill.slug },
      { location: `skills[${index}].name`, value: skill.name },
      { location: `skills[${index}].description`, value: skill.description },
      { location: `skills[${index}].version`, value: skill.version },
      ...skill.requiredCapabilities.map((value, capabilityIndex) => ({
        location: `skills[${index}].requiredCapabilities[${capabilityIndex}]`,
        value,
      })),
      ...skill.dependencySlugs.map((value, dependencyIndex) => ({
        location: `skills[${index}].dependencySlugs[${dependencyIndex}]`,
        value,
      })),
    ]),
  ];
  const findings: EmployeeExportFinding[] = [];
  for (const field of fields) {
    for (const pattern of sensitivePatterns) {
      if (!pattern.expression.test(field.value)) continue;
      findings.push({ code: pattern.code, location: field.location, message: pattern.message });
    }
  }
  return findings;
}

function portableFileStem(name: string): string {
  const stem = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return stem || "employee";
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
