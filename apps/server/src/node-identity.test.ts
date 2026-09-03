import { describe, expect, it } from "vitest";
import {
  InvalidNodeEnrollmentError,
  NodeIdentityNotFoundError,
  NodeIdentityService,
  type NodeIdentityStore,
  type StoredNodeEnrollmentToken,
} from "./node-identity.js";

describe("Node identity service", () => {
  it("exchanges a short-lived token once and stores only secret digests", async () => {
    const now = new Date("2026-09-04T00:00:00.000Z");
    const store = memoryNodeIdentityStore();
    const identity = new NodeIdentityService(store, () => now);
    const issued = await identity.issueEnrollmentToken({
      nodeId: "linux-node",
      expiresInSeconds: 600,
    });

    expect(issued.token).toMatch(/^obenr_/);
    expect(store.enrollments[0]?.tokenDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(store.enrollments[0]?.tokenDigest).not.toContain(issued.token);

    const enrolled = await identity.enroll({ nodeId: "linux-node", token: issued.token });
    expect(enrolled).toMatchObject({
      format: "openbot.node-identity/v1",
      nodeId: "linux-node",
    });
    expect(enrolled.credential).toMatch(/^obn_/);
    expect(await identity.authenticate("linux-node", enrolled.credential)).toBe(true);
    await expect(identity.enroll({ nodeId: "linux-node", token: issued.token })).rejects.toThrow(
      InvalidNodeEnrollmentError,
    );
  });

  it("replaces unused tokens and rejects expired or wrong-node exchanges", async () => {
    let now = new Date("2026-09-04T00:00:00.000Z");
    const store = memoryNodeIdentityStore();
    const identity = new NodeIdentityService(store, () => now);
    const first = await identity.issueEnrollmentToken({
      nodeId: "windows-node",
      expiresInSeconds: 60,
    });
    const replacement = await identity.issueEnrollmentToken({
      nodeId: "windows-node",
      expiresInSeconds: 60,
    });

    await expect(identity.enroll({ nodeId: "windows-node", token: first.token })).rejects.toThrow(
      InvalidNodeEnrollmentError,
    );
    await expect(
      identity.enroll({ nodeId: "other-node", token: replacement.token }),
    ).rejects.toThrow(InvalidNodeEnrollmentError);
    now = new Date("2026-09-04T00:01:01.000Z");
    await expect(
      identity.enroll({ nodeId: "windows-node", token: replacement.token }),
    ).rejects.toThrow(InvalidNodeEnrollmentError);
  });

  it("revokes one Node without changing another Node credential", async () => {
    const store = memoryNodeIdentityStore();
    const identity = new NodeIdentityService(store);
    const firstToken = await identity.issueEnrollmentToken({
      nodeId: "first",
      expiresInSeconds: 60,
    });
    const secondToken = await identity.issueEnrollmentToken({
      nodeId: "second",
      expiresInSeconds: 60,
    });
    const first = await identity.enroll({ nodeId: "first", token: firstToken.token });
    const second = await identity.enroll({ nodeId: "second", token: secondToken.token });

    await identity.revoke("first");
    expect(await identity.authenticate("first", first.credential)).toBe(false);
    expect(await identity.authenticate("second", second.credential)).toBe(true);
    await expect(identity.revoke("first")).rejects.toThrow(NodeIdentityNotFoundError);
  });
});

function memoryNodeIdentityStore(): NodeIdentityStore & {
  enrollments: Array<StoredNodeEnrollmentToken & { consumedAt?: Date }>;
} {
  const enrollments: Array<StoredNodeEnrollmentToken & { consumedAt?: Date }> = [];
  const credentials = new Map<
    string,
    { credentialDigest: string; revokedAt?: Date; lastAuthenticatedAt?: Date }
  >();
  return {
    enrollments,
    async replaceEnrollmentToken(record) {
      for (const enrollment of enrollments) {
        if (enrollment.nodeId === record.nodeId && enrollment.consumedAt === undefined) {
          enrollment.consumedAt = record.createdAt;
        }
      }
      enrollments.push({ ...record });
    },
    async exchangeEnrollmentToken(record) {
      const enrollment = enrollments.find(
        (item) =>
          item.nodeId === record.nodeId &&
          item.tokenDigest === record.tokenDigest &&
          item.consumedAt === undefined &&
          item.expiresAt > record.enrolledAt,
      );
      if (enrollment === undefined) return false;
      enrollment.consumedAt = record.enrolledAt;
      credentials.set(record.nodeId, { credentialDigest: record.credentialDigest });
      return true;
    },
    async authenticateCredential(nodeId, credentialDigest, authenticatedAt) {
      const credential = credentials.get(nodeId);
      if (
        credential === undefined ||
        credential.revokedAt !== undefined ||
        credential.credentialDigest !== credentialDigest
      ) {
        return false;
      }
      credential.lastAuthenticatedAt = authenticatedAt;
      return true;
    },
    async revokeCredential(nodeId, revokedAt) {
      const credential = credentials.get(nodeId);
      if (credential === undefined || credential.revokedAt !== undefined) return false;
      credential.revokedAt = revokedAt;
      return true;
    },
  };
}
