import { describe, expect, it } from "vitest";
import { nodeEnvSchema, serverEnvSchema } from "./index.js";

const required = {
  OPENBOT_OWNER_PASSWORD: "owner-password-for-tests",
};
const nodeCredential = `obn_${"a".repeat(43)}`;
const enrollmentToken = `obenr_${"b".repeat(43)}`;

describe("server environment", () => {
  it("normalizes local authentication settings", () => {
    const environment = serverEnvSchema.parse({
      ...required,
      OPENBOT_ALLOWED_ORIGINS: "http://localhost:5173, http://127.0.0.1:5173 ",
      OPENBOT_SESSION_TTL_HOURS: "24",
    });

    expect(environment.OPENBOT_ALLOWED_ORIGINS).toEqual([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]);
    expect(environment.OPENBOT_HOST).toBe("127.0.0.1");
    expect(environment.OPENBOT_SECURE_COOKIES).toBe(false);
    expect(environment.OPENBOT_SESSION_TTL_HOURS).toBe(24);
  });

  it("requires HTTPS and Secure cookies for every remote browser origin", () => {
    expect(
      serverEnvSchema.safeParse({
        ...required,
        OPENBOT_ALLOWED_ORIGINS: "http://openbot.example.test",
        OPENBOT_SECURE_COOKIES: "true",
      }).success,
    ).toBe(false);
    expect(
      serverEnvSchema.safeParse({
        ...required,
        OPENBOT_ALLOWED_ORIGINS: "https://openbot.example.test",
      }).success,
    ).toBe(false);
    expect(
      serverEnvSchema.parse({
        ...required,
        OPENBOT_ALLOWED_ORIGINS: "https://openbot.example.test",
        OPENBOT_SECURE_COOKIES: "true",
      }).OPENBOT_SECURE_COOKIES,
    ).toBe(true);
  });

  it("rejects non-HTTP origins", () => {
    expect(
      serverEnvSchema.safeParse({
        ...required,
        OPENBOT_ALLOWED_ORIGINS: "ftp://localhost",
      }).success,
    ).toBe(false);
  });

  it("rejects a short owner password and an empty origin list", () => {
    expect(
      serverEnvSchema.safeParse({ ...required, OPENBOT_OWNER_PASSWORD: "too-short" }).success,
    ).toBe(false);
    expect(serverEnvSchema.safeParse({ ...required, OPENBOT_ALLOWED_ORIGINS: "" }).success).toBe(
      false,
    );
    expect(
      serverEnvSchema.safeParse({
        ...required,
        OPENBOT_OWNER_PASSWORD: "replace-with-a-long-random-owner-password",
      }).success,
    ).toBe(false);
  });
});

describe("node environment", () => {
  it("bounds the advertised concurrency", () => {
    expect(
      nodeEnvSchema.parse({
        OPENBOT_NODE_ID: "linux-node",
        OPENBOT_NODE_CREDENTIAL: nodeCredential,
        OPENBOT_NODE_MAX_CONCURRENT_RUNS: "2",
      }).OPENBOT_NODE_MAX_CONCURRENT_RUNS,
    ).toBe(2);
    expect(
      nodeEnvSchema.safeParse({
        OPENBOT_NODE_ID: "linux-node",
        OPENBOT_NODE_CREDENTIAL: nodeCredential,
        OPENBOT_NODE_MAX_CONCURRENT_RUNS: "17",
      }).success,
    ).toBe(false);
  });

  it("enables the Docker computer only with a complete credential pair", () => {
    const base = {
      OPENBOT_NODE_ID: "linux-node",
      OPENBOT_NODE_CREDENTIAL: nodeCredential,
    };
    expect(
      nodeEnvSchema.safeParse({
        ...base,
        OPENBOT_DOCKER_COMPUTER_URL: "http://127.0.0.1:4100",
      }).success,
    ).toBe(false);
    expect(
      nodeEnvSchema.parse({
        ...base,
        OPENBOT_DOCKER_COMPUTER_URL: "http://127.0.0.1:4100",
        OPENBOT_DOCKER_COMPUTER_TOKEN: "computer-token-for-tests",
        OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS: "true",
      }).OPENBOT_DOCKER_ALLOW_PRIVATE_HOSTS,
    ).toBe(true);
  });

  it("requires bounded Node identity inputs and WSS off loopback", () => {
    const valid = {
      OPENBOT_NODE_ID: "linux-node:primary",
      OPENBOT_NODE_ENROLLMENT_TOKEN: enrollmentToken,
    };
    expect(nodeEnvSchema.safeParse(valid).success).toBe(true);
    expect(nodeEnvSchema.safeParse({ ...valid, OPENBOT_NODE_ID: "node id" }).success).toBe(false);
    expect(
      nodeEnvSchema.safeParse({ ...valid, OPENBOT_NODE_ENROLLMENT_TOKEN: "too-short" }).success,
    ).toBe(false);
    expect(
      nodeEnvSchema.safeParse({ ...valid, OPENBOT_NODE_SERVER_URL: "http://localhost:3001" })
        .success,
    ).toBe(false);
    expect(
      nodeEnvSchema.safeParse({ ...valid, OPENBOT_NODE_SERVER_URL: "ws://openbot.example.test" })
        .success,
    ).toBe(false);
    expect(
      nodeEnvSchema.safeParse({ ...valid, OPENBOT_NODE_SERVER_URL: "wss://openbot.example.test" })
        .success,
    ).toBe(true);
  });
});
