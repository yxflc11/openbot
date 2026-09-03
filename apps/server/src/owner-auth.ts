import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { AuthSessionSnapshot, OwnerIdentity } from "@openbot/domain";
import type { OwnerSessionStore } from "./session-store.js";

const loginFailureWindowMs = 5 * 60 * 1000;
const loginBlockMs = 5 * 60 * 1000;
const maximumFailures = 5;
const maximumTrackedClients = 500;

interface LoginFailureState {
  count: number;
  lastFailureAt: number;
  blockedUntil?: number;
}

export interface OwnerAuthOptions {
  ownerName: string;
  ownerPassword: string;
  sessionTtlMs: number;
}

export class InvalidCredentialsError extends Error {}

export class LoginRateLimitedError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many login attempts. Try again later.");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class OwnerAuthService {
  readonly #store: OwnerSessionStore;
  readonly #owner: OwnerIdentity;
  readonly #password: string;
  readonly #sessionTtlMs: number;
  readonly #loginFailures = new Map<string, LoginFailureState>();

  constructor(store: OwnerSessionStore, options: OwnerAuthOptions) {
    this.#store = store;
    this.#owner = { id: "owner", name: options.ownerName };
    this.#password = options.ownerPassword;
    this.#sessionTtlMs = options.sessionTtlMs;
  }

  async login(
    password: string,
    clientKey: string,
  ): Promise<{ token: string; session: AuthSessionSnapshot & { authenticated: true } }> {
    const now = new Date();
    this.#assertLoginAllowed(clientKey, now.getTime());
    if (!constantTimeEqual(password, this.#password)) {
      this.#recordLoginFailure(clientKey, now.getTime());
      throw new InvalidCredentialsError("Invalid owner password.");
    }

    this.#loginFailures.delete(clientKey);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + this.#sessionTtlMs);
    await this.#store.createSession({
      id: randomUUID(),
      ownerId: "owner",
      tokenDigest: digestToken(token),
      expiresAt,
      createdAt: now,
    });
    return {
      token,
      session: {
        authenticated: true,
        owner: this.#owner,
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async authenticate(token: string | undefined): Promise<AuthSessionSnapshot> {
    if (token === undefined || token.length === 0) return { authenticated: false };
    const session = await this.#store.findActiveSession(digestToken(token), new Date());
    if (session === undefined) return { authenticated: false };
    return {
      authenticated: true,
      owner: this.#owner,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (token === undefined || token.length === 0) return;
    await this.#store.revokeSession(digestToken(token), new Date());
  }

  #assertLoginAllowed(clientKey: string, now: number): void {
    const state = this.#loginFailures.get(clientKey);
    if (state === undefined) return;
    if (state.blockedUntil !== undefined && state.blockedUntil > now) {
      throw new LoginRateLimitedError(Math.ceil((state.blockedUntil - now) / 1000));
    }
    if (now - state.lastFailureAt > loginFailureWindowMs) this.#loginFailures.delete(clientKey);
  }

  #recordLoginFailure(clientKey: string, now: number): void {
    const previous = this.#loginFailures.get(clientKey);
    const count =
      previous === undefined || now - previous.lastFailureAt > loginFailureWindowMs
        ? 1
        : previous.count + 1;
    if (previous === undefined && this.#loginFailures.size >= maximumTrackedClients) {
      const oldestKey = this.#loginFailures.keys().next().value;
      if (oldestKey !== undefined) this.#loginFailures.delete(oldestKey);
    }
    this.#loginFailures.set(clientKey, {
      count,
      lastFailureAt: now,
      ...(count >= maximumFailures ? { blockedUntil: now + loginBlockMs } : {}),
    });
  }
}

function digestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function constantTimeEqual(value: string, expected: string): boolean {
  const valueDigest = createHash("sha256").update(value).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(valueDigest, expectedDigest);
}
