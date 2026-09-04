import { describe, expect, it } from "vitest";
import { InvalidCredentialsError, LoginRateLimitedError, OwnerAuthService } from "./owner-auth.js";
import { RequestThrottle, type RequestThrottleStore } from "./request-throttle.js";
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
    const throttleStore = createMemoryThrottleStore();
    const auth = createAuth(createMemorySessionStore(), 60_000, throttleStore);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(auth.login("wrong-password", "client-1")).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
    }
    await expect(auth.login("wrong-password", "client-1")).rejects.toBeInstanceOf(
      LoginRateLimitedError,
    );
  });

  it("shares throttle state across service restarts and clears it after success", async () => {
    const throttleStore = createMemoryThrottleStore();
    const sessionStore = createMemorySessionStore();
    const first = createAuth(sessionStore, 60_000, throttleStore);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(first.login("wrong-password", "client-1")).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
    }

    const restarted = createAuth(sessionStore, 60_000, throttleStore);
    await expect(restarted.login("correct-owner-password", "client-1")).rejects.toBeInstanceOf(
      LoginRateLimitedError,
    );

    await restarted.login("correct-owner-password", "client-2");
    await expect(restarted.login("wrong-password", "client-2")).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    expect(throttleStore.buckets.get("owner-login:client-2")?.attemptCount).toBe(1);
  });

  it("fails closed when durable throttle storage is unavailable", async () => {
    const throttleStore = createMemoryThrottleStore();
    throttleStore.reserveAttempt = async () => {
      throw new Error("database unavailable");
    };
    const auth = createAuth(createMemorySessionStore(), 60_000, throttleStore);

    await expect(auth.login("correct-owner-password", "client-1")).rejects.toThrow(
      "database unavailable",
    );
  });

  it("admits at most five concurrent attempts for one durable bucket", async () => {
    const auth = createAuth(createMemorySessionStore());
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, () => auth.login("wrong-password", "client-1")),
    );

    expect(
      attempts.filter(
        (attempt) =>
          attempt.status === "rejected" && attempt.reason instanceof InvalidCredentialsError,
      ),
    ).toHaveLength(5);
    expect(
      attempts.filter(
        (attempt) =>
          attempt.status === "rejected" && attempt.reason instanceof LoginRateLimitedError,
      ),
    ).toHaveLength(1);
  });
});

function createAuth(
  store: MemorySessionStore,
  sessionTtlMs = 60_000,
  throttleStore = createMemoryThrottleStore(),
) {
  return new OwnerAuthService(
    store,
    {
      ownerName: "Local Owner",
      ownerPassword: "correct-owner-password",
      sessionTtlMs,
    },
    new RequestThrottle(throttleStore),
  );
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

function createMemoryThrottleStore(): RequestThrottleStore & {
  buckets: Map<string, { attemptCount: number; windowStartedAt: Date; blockedUntil?: Date }>;
} {
  const buckets = new Map<
    string,
    { attemptCount: number; windowStartedAt: Date; blockedUntil?: Date }
  >();
  return {
    buckets,
    async reserveAttempt(input) {
      const key = `${input.scope}:${input.clientDigest}`;
      const current = buckets.get(key);
      if (current?.blockedUntil !== undefined && current.blockedUntil > input.now) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(
            (current.blockedUntil.getTime() - input.now.getTime()) / 1000,
          ),
        };
      }
      const windowExpired =
        current === undefined ||
        input.now.getTime() - current.windowStartedAt.getTime() >= input.windowMs;
      const attemptCount = windowExpired ? 1 : current.attemptCount + 1;
      buckets.set(key, {
        attemptCount,
        windowStartedAt: windowExpired ? input.now : current.windowStartedAt,
        ...(attemptCount >= input.maximumAttempts
          ? { blockedUntil: new Date(input.now.getTime() + input.blockMs) }
          : {}),
      });
      return { allowed: true };
    },
    async clearAttempts(scope, clientDigest) {
      buckets.delete(`${scope}:${clientDigest}`);
    },
  };
}
