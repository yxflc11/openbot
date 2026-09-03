import { describe, expect, it } from "vitest";
import { InvalidCredentialsError, LoginRateLimitedError, OwnerAuthService } from "./owner-auth.js";
import type {
  CreateOwnerSessionInput,
  OwnerSessionStore,
  StoredOwnerSession,
} from "./session-store.js";

describe("OwnerAuthService", () => {
  it("stores only a token digest and revokes the session on logout", async () => {
    const store = createMemorySessionStore();
    const auth = createAuth(store);
    const result = await auth.login("correct-owner-password", "client-1");

    expect(result.token).toHaveLength(43);
    expect(store.sessions[0]?.tokenDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(store.sessions[0]?.tokenDigest).not.toBe(result.token);
    expect(await auth.authenticate(result.token)).toMatchObject({
      authenticated: true,
      owner: { id: "owner", name: "Local Owner" },
    });

    await auth.logout(result.token);
    expect(await auth.authenticate(result.token)).toEqual({ authenticated: false });
  });

  it("rejects invalid and expired sessions", async () => {
    const store = createMemorySessionStore();
    const auth = createAuth(store, -1000);

    await expect(auth.login("wrong-password", "client-1")).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    const expired = await auth.login("correct-owner-password", "client-2");
    expect(await auth.authenticate(expired.token)).toEqual({ authenticated: false });
    expect(await auth.authenticate("unknown-token")).toEqual({ authenticated: false });
  });

  it("blocks a client after five failed attempts", async () => {
    const auth = createAuth(createMemorySessionStore());
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(auth.login("wrong-password", "client-1")).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
    }
    await expect(auth.login("wrong-password", "client-1")).rejects.toBeInstanceOf(
      LoginRateLimitedError,
    );
  });
});

function createAuth(store: MemorySessionStore, sessionTtlMs = 60_000) {
  return new OwnerAuthService(store, {
    ownerName: "Local Owner",
    ownerPassword: "correct-owner-password",
    sessionTtlMs,
  });
}

interface MemorySessionStore extends OwnerSessionStore {
  sessions: Array<StoredOwnerSession & { revokedAt?: Date }>;
}

function createMemorySessionStore(): MemorySessionStore {
  const sessions: Array<StoredOwnerSession & { revokedAt?: Date }> = [];
  return {
    sessions,
    async createSession(input: CreateOwnerSessionInput) {
      const session = { ...input };
      sessions.push(session);
      return session;
    },
    async findActiveSession(tokenDigest: string, now: Date) {
      return sessions.find(
        (session) =>
          session.tokenDigest === tokenDigest &&
          session.revokedAt === undefined &&
          session.expiresAt > now,
      );
    },
    async revokeSession(tokenDigest: string, now: Date) {
      const session = sessions.find((item) => item.tokenDigest === tokenDigest);
      if (session !== undefined) session.revokedAt = now;
    },
  };
}
