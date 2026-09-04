import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const systemUnit = new URL("../../../deploy/node/systemd/openbot-node.service", import.meta.url);
const userUnit = new URL("../../../deploy/node/systemd/openbot-node-user.service", import.meta.url);

describe("Linux systemd service profiles", () => {
  it("pins the headless system service to a dedicated file-backed identity", async () => {
    const source = await readFile(systemUnit, "utf8");

    expect(source).toContain("User=openbot\nGroup=openbot");
    expect(source).toContain("StateDirectory=openbot-node");
    expect(source).toContain("StateDirectoryMode=0700");
    expect(source).toContain("OPENBOT_NODE_CREDENTIAL_STORE=file");
    expect(source).toContain("/opt/openbot-node/current/bin/node");
    expect(source).toContain("/opt/openbot-node/current/app/index.js");
    expect(source).not.toContain("secret-service");
    expectCommonHardening(source);
  });

  it("pins the logged-in user service to Secret Service without a file fallback", async () => {
    const source = await readFile(userUnit, "utf8");

    expect(source).toContain("PartOf=graphical-session.target");
    expect(source).toContain("EnvironmentFile=%h/.config/openbot/node.env");
    expect(source).toContain("OPENBOT_NODE_CREDENTIAL_STORE=secret-service");
    expect(source).toContain("/opt/openbot-node/current/bin/node");
    expect(source).toContain("/opt/openbot-node/current/app/index.js");
    expect(source).not.toMatch(/OPENBOT_NODE_CREDENTIAL_STORE=file(?:\s|$)/);
    expect(source).not.toContain("User=");
    expectCommonHardening(source);
  });
});

function expectCommonHardening(source: string): void {
  for (const directive of [
    "Type=exec",
    "UMask=0077",
    "NoNewPrivileges=true",
    "PrivateTmp=true",
    "PrivateDevices=true",
    "ProtectSystem=strict",
    "ProtectHostname=true",
    "ProtectKernelTunables=true",
    "ProtectKernelModules=true",
    "ProtectKernelLogs=true",
    "ProtectControlGroups=true",
    "RestrictSUIDSGID=true",
    "LockPersonality=true",
    "RestrictRealtime=true",
    "CapabilityBoundingSet=",
    "AmbientCapabilities=",
    "RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6",
  ]) {
    expect(source).toContain(directive);
  }
  expect(source).not.toContain("ListenStream=");
  expect(source).not.toContain("MemoryDenyWriteExecute=");
  expect(source).not.toContain("SystemCallFilter=");
}
