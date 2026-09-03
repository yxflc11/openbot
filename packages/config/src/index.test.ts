import { describe, expect, it } from "vitest";
import { nodeEnvSchema, serverEnvSchema } from "./index.js";

const required = {
  OPENBOT_NODE_TOKEN: "node-token",
  OPENBOT_OWNER_PASSWORD: "owner-password-for-tests",
};

describe("server environment", () => {
  it("normalizes local authentication settings", () => {
    const environment = serverEnvSchema.parse({
      ...required,
      OPENBOT_ALLOWED_ORIGINS: "https://openbot.example.test, http://localhost:5173 ",
      OPENBOT_SECURE_COOKIES: "true",
      OPENBOT_SESSION_TTL_HOURS: "24",
    });

    expect(environment.OPENBOT_ALLOWED_ORIGINS).toEqual([
      "https://openbot.example.test",
      "http://localhost:5173",
    ]);
    expect(environment.OPENBOT_SECURE_COOKIES).toBe(true);
    expect(environment.OPENBOT_SESSION_TTL_HOURS).toBe(24);
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
        OPENBOT_NODE_TOKEN: "node-token",
        OPENBOT_NODE_MAX_CONCURRENT_RUNS: "2",
      }).OPENBOT_NODE_MAX_CONCURRENT_RUNS,
    ).toBe(2);
    expect(
      nodeEnvSchema.safeParse({
        OPENBOT_NODE_ID: "linux-node",
        OPENBOT_NODE_TOKEN: "node-token",
        OPENBOT_NODE_MAX_CONCURRENT_RUNS: "17",
      }).success,
    ).toBe(false);
  });
});
