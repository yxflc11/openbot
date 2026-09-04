import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  MACOS_NCC_OUTPUTS,
  assertMacOSAccessGroup,
  assertMacOSDeveloperIdentities,
  assertMacOSExtendedAttributes,
  distributionSigningPlan,
  expandEntitlementsTemplate,
  sealMacOSWorkerHostApplicationMetadata,
  stageMacOSWorkerHostApplication,
  validateMacOSWorkerHostApplication,
  validateMacOSProvisioningProfile,
} from "./macos-worker-host-release.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceCommit = "a".repeat(40);

test("stages and validates the exact unsigned macOS application", async (context) => {
  const fixture = await createFixture(context);
  const application = path.join(fixture.root, "OpenBot Worker Host.app");
  await stage(fixture, application);
  const manifest = await validateMacOSWorkerHostApplication(application, {
    expectedOwner: process.getuid?.(),
  });
  assert.equal(manifest.architecture, "arm64");
  assert.deepEqual(
    manifest.files.map((file) => file.path),
    ["Contents/Resources/node/app/index.js", "Contents/Resources/node/bin/node"],
  );
  assert.match(
    await readFile(path.join(application, "Contents/Info.plist"), "utf8"),
    /<string>1\.2\.3<\/string>/,
  );
});

test("rejects linked input, ncc inventory drift, and staged tampering", async (context) => {
  const linked = await createFixture(context);
  const target = path.join(linked.root, "linked-control");
  await symlink(linked.controlBinary, target);
  linked.controlBinary = target;
  await assert.rejects(stage(linked, path.join(linked.root, "Linked.app")), /staging input/);

  const drift = await createFixture(context);
  await writeFile(path.join(drift.nodeBundleDirectory, "unexpected.js"), "unexpected");
  await assert.rejects(stage(drift, path.join(drift.root, "Drift.app")), /inventory/);

  const tampered = await createFixture(context);
  const application = path.join(tampered.root, "Tampered.app");
  await stage(tampered, application);
  await writeFile(path.join(application, "Contents/Resources/node/app/index.js"), "tampered");
  await assert.rejects(
    validateMacOSWorkerHostApplication(application, { expectedOwner: process.getuid?.() }),
    /manifest|mode/,
  );
});

test("expands only the exact shared access group", async () => {
  const template = await readFile(
    path.join(
      repositoryRoot,
      "apps/worker-host-macos/Resources/OpenBotWorkerHost.entitlements.template.plist",
    ),
    "utf8",
  );
  const group = "A1B2C3D4E5.com.openbot.worker-host.shared";
  const expanded = expandEntitlementsTemplate(template, group);
  assert.match(expanded, new RegExp(group.replaceAll(".", "\\.")));
  assert.match(expanded, /A1B2C3D4E5\.com\.openbot\.worker-host/);
  assert.match(expanded, /<string>A1B2C3D4E5<\/string>/);
  assert.doesNotMatch(expanded, /OPENBOT_|get-task-allow|app-sandbox/);
  assert.throws(() => assertMacOSAccessGroup("com.openbot.worker-host.shared"), /Team ID/);
  assert.throws(
    () => expandEntitlementsTemplate(`${template}OPENBOT_ACCESS_GROUP`, group),
    /placeholder/,
  );
});

test("binds Developer ID identities and provisioning to one exact application", () => {
  const accessGroup = "A1B2C3D4E5.com.openbot.worker-host.shared";
  const identities = {
    applicationIdentity: "Developer ID Application: OpenBot (A1B2C3D4E5)",
    installerIdentity: "Developer ID Installer: OpenBot (A1B2C3D4E5)",
  };
  assert.equal(assertMacOSDeveloperIdentities(identities, accessGroup), "A1B2C3D4E5");
  assert.throws(
    () =>
      assertMacOSDeveloperIdentities(
        { ...identities, installerIdentity: "Developer ID Installer: Other (Z9Y8X7W6V5)" },
        accessGroup,
      ),
    /identity/,
  );

  const profile = {
    ProvisionsAllDevices: true,
    Platform: ["OSX"],
    TeamIdentifier: ["A1B2C3D4E5"],
    ApplicationIdentifierPrefix: ["A1B2C3D4E5"],
    ExpirationDate: "2027-09-04T00:00:00.000Z",
    Entitlements: {
      "com.apple.application-identifier": "A1B2C3D4E5.com.openbot.worker-host",
      "com.apple.developer.team-identifier": "A1B2C3D4E5",
      "keychain-access-groups": ["A1B2C3D4E5.*"],
      "get-task-allow": false,
    },
  };
  assert.doesNotThrow(() =>
    validateMacOSProvisioningProfile(profile, {
      accessGroup,
      now: new Date("2026-09-04T00:00:00.000Z"),
    }),
  );
  assert.throws(
    () =>
      validateMacOSProvisioningProfile(
        {
          ...profile,
          Entitlements: { ...profile.Entitlements, "keychain-access-groups": ["Z9Y8X7W6V5.*"] },
        },
        { accessGroup, now: new Date("2026-09-04T00:00:00.000Z") },
      ),
    /does not authorize/,
  );
});

test("rejects dangerous extended attributes while tolerating system provenance", () => {
  assert.doesNotThrow(() => assertMacOSExtendedAttributes(""));
  assert.doesNotThrow(() =>
    assertMacOSExtendedAttributes("/tmp/OpenBot.app: com.apple.provenance\n", {
      allowProvenance: true,
    }),
  );
  assert.throws(
    () =>
      assertMacOSExtendedAttributes("/tmp/OpenBot.app: com.apple.quarantine\n", {
        allowProvenance: true,
      }),
    /unexpected extended attribute/,
  );
  assert.throws(
    () => assertMacOSExtendedAttributes("/tmp/OpenBot.app: com.apple.FinderInfo\n"),
    /unexpected extended attribute/,
  );
});

test("refreshes signed runtime bytes before the outer application seal", async (context) => {
  const fixture = await createFixture(context);
  const application = path.join(fixture.root, "Signing.app");
  await stage(fixture, application);
  const node = path.join(application, "Contents/Resources/node/bin/node");
  await writeFile(node, Buffer.alloc(20 * 1024 * 1024, "s"));
  await assert.rejects(
    validateMacOSWorkerHostApplication(application, { expectedOwner: process.getuid?.() }),
    /manifest/,
  );

  await sealMacOSWorkerHostApplicationMetadata(application);
  await validateMacOSWorkerHostApplication(application, {
    expectedOwner: process.getuid?.(),
    expectedSigned: true,
  });
  const build = JSON.parse(
    await readFile(path.join(application, "Contents/Resources/build.json"), "utf8"),
  );
  assert.equal(build.signed, true);
});

test("locks distribution to inside-out signing and notarization", () => {
  const plan = distributionSigningPlan({
    applicationPath: "/tmp/OpenBot Worker Host.app",
    outputPackage: "/tmp/openbot.pkg",
    identities: {
      applicationIdentity: "Developer ID Application: OpenBot (A1B2C3D4E5)",
      installerIdentity: "Developer ID Installer: OpenBot (A1B2C3D4E5)",
    },
    notaryProfile: "openbot-notary",
  });
  assert.deepEqual(
    plan.map((step) => step.role),
    [
      "node",
      "seal-metadata",
      "application",
      "verify-application",
      "package",
      "verify-package",
      "notarize",
      "staple",
      "gatekeeper",
    ],
  );
  assert.throws(
    () =>
      distributionSigningPlan({
        applicationPath: "/tmp/a.app",
        outputPackage: "/tmp/a.pkg",
        identities: { applicationIdentity: "-", installerIdentity: "installer" },
        notaryProfile: "profile",
      }),
    /invalid/,
  );
});

async function createFixture(context) {
  const root = await mkdtemp(path.join(tmpdir(), "openbot-macos-release-test-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const fixture = {
    root,
    controlBinary: path.join(root, "OpenBotWorkerHostControl"),
    nodeBinary: path.join(root, "node"),
    nodeLicense: path.join(root, "NODE_LICENSE"),
    nodeBundleDirectory: path.join(root, "bundle"),
  };
  await writeSized(fixture.controlBinary, 16 * 1024);
  await writeSized(fixture.nodeBinary, 20 * 1024 * 1024);
  await writeSized(fixture.nodeLicense, 1_024);
  await mkdir(fixture.nodeBundleDirectory);
  for (const name of MACOS_NCC_OUTPUTS) {
    await writeFile(path.join(fixture.nodeBundleDirectory, name), `${name}\n`);
  }
  return fixture;
}

async function writeSized(target, size) {
  await writeFile(target, "x", { mode: 0o600 });
  await truncate(target, size);
}

function stage(fixture, destination) {
  return stageMacOSWorkerHostApplication({
    architecture: "arm64",
    buildVersion: "123",
    controlBinary: fixture.controlBinary,
    destination,
    enrollmentDocumentation: path.join(repositoryRoot, "docs/NODE_ENROLLMENT.md"),
    enrollmentDocumentationChinese: path.join(repositoryRoot, "docs/NODE_ENROLLMENT.zh-CN.md"),
    infoTemplate: path.join(repositoryRoot, "apps/worker-host-macos/Resources/Info.plist.template"),
    launchAgentPlist: path.join(
      repositoryRoot,
      "apps/worker-host-macos/Resources/com.openbot.worker-host.node.plist",
    ),
    nodeBinary: fixture.nodeBinary,
    nodeBundleDirectory: fixture.nodeBundleDirectory,
    nodeLicense: fixture.nodeLicense,
    openBotLicense: path.join(repositoryRoot, "LICENSE"),
    sourceCommit,
    version: "1.2.3",
  });
}
