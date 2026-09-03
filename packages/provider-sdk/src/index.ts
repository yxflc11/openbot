import type { NodeCapability, NodeCapabilityDescriptor, NodePlatform } from "@openbot/protocol";

export interface ProviderContext {
  nodeId: string;
  workDirectory: string;
  signal: AbortSignal;
}

export interface ProviderRunInput {
  runId: string;
  channelId: string;
  botId: string;
  title: string;
  instruction: string;
  executionProfile: "docker-linux" | "macos-cua" | "lume-vm" | "coder";
}

export interface ProviderArtifact {
  name: string;
  mediaType: "image/png";
  base64: string;
  metadata?: Record<string, unknown>;
}

/**
 * A side effect frozen before approval. Providers must commit this exact action rather than
 * recomputing a target from mutable model output after approval.
 */
export interface PreparedAction {
  actionId: string;
  action: string;
  target: string;
  summary: string;
  risk: "read" | "write" | "destructive" | "privileged";
  beforeState?: Record<string, unknown>;
  expiresInSeconds?: number;
}

export interface ApprovalOutcome {
  approvalId: string;
  status: "approved" | "rejected" | "expired";
}

export interface ProviderResult {
  ok: boolean;
  summary: string;
  artifacts: ProviderArtifact[];
}

export interface ProviderProgress {
  stage: string;
  message: string;
}

export interface ProviderFrame {
  mediaType: "image/png";
  base64: string;
  width?: number;
  height?: number;
  capturedAt: string;
}

/**
 * A replaceable execution backend. Declared capabilities describe what the backend can do; they
 * never authorize a Run or bypass Server policy.
 */
export interface ComputerProvider {
  id: string;
  displayName: string;
  platforms: NodePlatform[];
  capabilities: NodeCapability[];
  capabilityManifest: NodeCapabilityDescriptor[];
  execute?(
    context: ProviderContext,
    input: ProviderRunInput,
    report: (progress: ProviderProgress) => void,
    reportFrame?: (frame: ProviderFrame) => void,
    requestApproval?: (action: PreparedAction) => Promise<ApprovalOutcome>,
  ): Promise<ProviderResult>;
  prepare?(context: ProviderContext, action: unknown): Promise<PreparedAction>;
  commit?(context: ProviderContext, prepared: PreparedAction): Promise<ProviderResult>;
}

export type ProviderConformanceIssueCode =
  | "provider-id-invalid"
  | "display-name-missing"
  | "platforms-empty"
  | "platform-duplicate"
  | "platform-unknown"
  | "legacy-capability-duplicate"
  | "capability-manifest-empty"
  | "capability-provider-mismatch"
  | "capability-duplicate";

export interface ProviderConformanceIssue {
  code: ProviderConformanceIssueCode;
  message: string;
}

export interface ProviderDeclarationReport {
  providerId: string;
  conformant: boolean;
  executionStatus: "executable" | "declaration-only";
  issues: ProviderConformanceIssue[];
}

/**
 * Validate the static declaration every Worker Host publishes. This is intentionally independent
 * from runtime certification: a well-formed declaration does not prove that execution works.
 */
export function inspectProviderDeclaration(provider: ComputerProvider): ProviderDeclarationReport {
  const issues: ProviderConformanceIssue[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(provider.id)) {
    issues.push({
      code: "provider-id-invalid",
      message: "Provider id must use lowercase ASCII letters, numbers, and hyphens.",
    });
  }
  if (provider.displayName.trim().length === 0) {
    issues.push({ code: "display-name-missing", message: "Provider display name is required." });
  }
  if (provider.platforms.length === 0) {
    issues.push({ code: "platforms-empty", message: "At least one platform must be declared." });
  }
  if (new Set(provider.platforms).size !== provider.platforms.length) {
    issues.push({ code: "platform-duplicate", message: "Platforms must not contain duplicates." });
  }
  if (provider.platforms.includes("unknown")) {
    issues.push({
      code: "platform-unknown",
      message: "A Provider cannot claim the unknown platform as supported.",
    });
  }
  if (new Set(provider.capabilities).size !== provider.capabilities.length) {
    issues.push({
      code: "legacy-capability-duplicate",
      message: "Legacy capability aliases must not contain duplicates.",
    });
  }
  if (provider.capabilities.length > 0 && provider.capabilityManifest.length === 0) {
    issues.push({
      code: "capability-manifest-empty",
      message: "Legacy capability aliases require versioned capability descriptors.",
    });
  }

  const descriptorKeys = new Set<string>();
  for (const descriptor of provider.capabilityManifest) {
    if (descriptor.providerId !== provider.id) {
      issues.push({
        code: "capability-provider-mismatch",
        message: `${descriptor.id}@${descriptor.version} names provider ${descriptor.providerId}, expected ${provider.id}.`,
      });
    }
    const key = `${descriptor.id}@${descriptor.version}`;
    if (descriptorKeys.has(key)) {
      issues.push({
        code: "capability-duplicate",
        message: `Capability ${key} is declared more than once.`,
      });
    }
    descriptorKeys.add(key);
  }

  return {
    providerId: provider.id,
    conformant: issues.length === 0,
    executionStatus: provider.execute === undefined ? "declaration-only" : "executable",
    issues,
  };
}

export function assertProviderDeclarations(providers: ComputerProvider[]): void {
  const reports = providers.map(inspectProviderDeclaration).filter((report) => !report.conformant);
  if (reports.length === 0) return;
  const details = reports
    .flatMap((report) => report.issues.map((issue) => `${report.providerId}:${issue.code}`))
    .join(", ");
  throw new Error(`Invalid Provider declaration(s): ${details}.`);
}
