import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertMacOSAccessGroup,
  distributionSigningPlan,
  expandEntitlementsTemplate,
  validateMacOSWorkerHostApplication,
} from "./macos-worker-host-release.mjs";

if (process.platform !== "darwin") {
  throw new Error("macOS distribution packaging can only run on macOS.");
}
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArguments(process.argv.slice(2));
await validateMacOSWorkerHostApplication(options.application, {
  expectedOwner: process.getuid?.(),
});
const plan = distributionSigningPlan({
  applicationPath: options.application,
  outputPackage: options.outputPackage,
  identities: {
    applicationIdentity: options.applicationIdentity,
    installerIdentity: options.installerIdentity,
  },
  notaryProfile: options.notaryProfile,
});
if (
  plan.map((step) => step.role).join(",") !==
  "node,launcher,application,verify-application,package,verify-package,notarize,staple,gatekeeper"
) {
  throw new Error("macOS distribution signing order is invalid.");
}

const scratch = await mkdtemp(path.join(tmpdir(), "openbot-macos-distribution-"));
try {
  const application = path.join(scratch, "OpenBot Worker Host.app");
  run("/usr/bin/ditto", [options.application, application]);
  run("/usr/bin/ditto", [
    options.provisioningProfile,
    path.join(application, "Contents/embedded.provisionprofile"),
  ]);
  await chmod(path.join(application, "Contents/embedded.provisionprofile"), 0o644);
  const entitlementSource = await readFile(options.entitlementsTemplate, "utf8");
  const entitlements = path.join(scratch, "OpenBotWorkerHost.entitlements.plist");
  await writeFile(
    entitlements,
    expandEntitlementsTemplate(entitlementSource, options.accessGroup),
    { encoding: "utf8", mode: 0o600, flag: "wx" },
  );
  run("/usr/bin/plutil", ["-lint", entitlements]);

  const node = path.join(application, "Contents/Resources/node/bin/node");
  const launcher = path.join(application, "Contents/Resources/OpenBotWorkerHostLauncher");
  run("/usr/bin/codesign", [
    "--force",
    "--sign",
    options.applicationIdentity,
    "--options",
    "runtime",
    "--timestamp",
    node,
  ]);
  run("/usr/bin/codesign", [
    "--force",
    "--sign",
    options.applicationIdentity,
    "--options",
    "runtime",
    "--timestamp",
    "--entitlements",
    entitlements,
    launcher,
  ]);
  run("/usr/bin/codesign", [
    "--force",
    "--sign",
    options.applicationIdentity,
    "--options",
    "runtime",
    "--timestamp",
    "--entitlements",
    entitlements,
    application,
  ]);
  run("/usr/bin/codesign", ["--verify", "--deep", "--strict", "--verbose=4", application]);
  await validateMacOSWorkerHostApplication(application, {
    expectedOwner: process.getuid?.(),
    allowDistributionArtifacts: true,
  });

  await mkdir(path.dirname(options.outputPackage), { recursive: true });
  run("/usr/bin/productbuild", [
    "--sign",
    options.installerIdentity,
    "--component",
    application,
    "/Applications",
    options.outputPackage,
  ]);
  run("/usr/sbin/pkgutil", ["--check-signature", options.outputPackage]);
  const notarization = JSON.parse(
    run("/usr/bin/xcrun", [
      "notarytool",
      "submit",
      options.outputPackage,
      "--keychain-profile",
      options.notaryProfile,
      "--wait",
      "--output-format",
      "json",
    ]),
  );
  if (notarization?.status !== "Accepted") {
    throw new Error("Apple did not accept the macOS Worker Host package for notarization.");
  }
  run("/usr/bin/xcrun", ["stapler", "staple", options.outputPackage]);
  run("/usr/bin/xcrun", ["stapler", "validate", options.outputPackage]);
  run("/usr/sbin/spctl", ["--assess", "--verbose=4", "--type", "install", options.outputPackage]);
  process.stdout.write(
    `${JSON.stringify({ package: options.outputPackage, notarizationId: notarization.id, signed: true, notarized: true }, null, 2)}\n`,
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}

function run(command, arguments_) {
  return execFileSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin:/usr/sbin:/sbin", LC_ALL: "C", TZ: "UTC" },
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function parseArguments(arguments_) {
  const values = new Map();
  for (let index = 0; index < arguments_.length; index += 2) {
    const key = arguments_[index];
    const value = arguments_[index + 1];
    if (
      !key?.startsWith("--") ||
      value === undefined ||
      value.startsWith("--") ||
      values.has(key)
    ) {
      throw new Error("macOS distribution arguments must be unique --name value pairs.");
    }
    values.set(key, value);
  }
  const allowed = new Set([
    "--access-group",
    "--app",
    "--application-identity",
    "--entitlements-template",
    "--installer-identity",
    "--notary-profile",
    "--output",
    "--provisioning-profile",
  ]);
  for (const key of values.keys()) {
    if (!allowed.has(key)) throw new Error(`Unknown macOS distribution argument: ${key}.`);
  }
  const required = (key) => {
    const value = values.get(key);
    if (value === undefined) throw new Error(`Missing macOS distribution argument: ${key}.`);
    return value;
  };
  const absolute = (key) => {
    const value = required(key);
    if (!path.isAbsolute(value)) throw new Error(`macOS path must be absolute: ${key}.`);
    return path.resolve(value);
  };
  return {
    accessGroup: assertMacOSAccessGroup(required("--access-group")),
    application: absolute("--app"),
    applicationIdentity: required("--application-identity"),
    entitlementsTemplate: absolute("--entitlements-template"),
    installerIdentity: required("--installer-identity"),
    notaryProfile: required("--notary-profile"),
    outputPackage: absolute("--output"),
    provisioningProfile: absolute("--provisioning-profile"),
  };
}
