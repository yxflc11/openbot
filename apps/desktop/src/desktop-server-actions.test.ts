import { describe, expect, it, vi } from "vitest";
import {
  isDesktopSessionAuthenticated,
  issueDesktopNodeEnrollmentToken,
} from "./desktop-server-actions.js";

const connection = { status: "configured" as const, serverUrl: "https://openbot.example" };
const now = Date.parse("2026-09-05T00:00:00.000Z");

describe("Desktop privileged Server actions", () => {
  it("checks authentication through the dedicated session without renderer credentials", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        authenticated: true,
        expiresAt: "2026-09-05T01:00:00.000Z",
        owner: { id: "owner", name: "Owner" },
      }),
    );
    await expect(isDesktopSessionAuthenticated(connection, fetcher)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      "https://openbot.example/api/v1/auth/session",
      expect.objectContaining({ credentials: "include", method: "GET", redirect: "manual" }),
    );
  });

  it("issues and strictly validates one ten-minute token only in the main process", async () => {
    const token = `obenr_${"t".repeat(43)}`;
    const fetcher = vi.fn(async () =>
      Response.json(
        { nodeId: "mac-node", token, expiresAt: "2026-09-05T00:10:00.000Z" },
        { status: 201 },
      ),
    );
    await expect(
      issueDesktopNodeEnrollmentToken("mac-node", connection, fetcher, now),
    ).resolves.toEqual({ status: "issued", token });
    const [target, init] = fetcher.mock.calls[0] ?? [];
    expect(target).toBe("https://openbot.example/api/v1/nodes/enrollment-tokens");
    expect(init).toMatchObject({ credentials: "include", method: "POST", redirect: "manual" });
    expect(new Headers(init?.headers).get("origin")).toBe("https://openbot.example");
    expect(new TextDecoder().decode(init?.body as Uint8Array)).toBe(
      '{"expiresInSeconds":600,"nodeId":"mac-node"}',
    );
  });

  it("collapses authentication, redirect, oversized, and malformed responses", async () => {
    await expect(
      issueDesktopNodeEnrollmentToken(
        "mac-node",
        connection,
        vi.fn(async () => Response.json({ error: "Authentication required" }, { status: 401 })),
        now,
      ),
    ).resolves.toEqual({ status: "authentication-required" });
    await expect(
      issueDesktopNodeEnrollmentToken(
        "mac-node",
        connection,
        vi.fn(async () =>
          Response.json(
            {
              nodeId: "other-node",
              token: `obenr_${"t".repeat(43)}`,
              expiresAt: "2026-09-05T00:10:00.000Z",
            },
            { status: 201 },
          ),
        ),
        now,
      ),
    ).resolves.toEqual({ status: "server-unavailable" });
    await expect(
      issueDesktopNodeEnrollmentToken(
        "mac-node",
        connection,
        vi.fn(
          async () =>
            new Response("x".repeat(4 * 1024 + 1), {
              headers: { "Content-Type": "application/json" },
              status: 201,
            }),
        ),
        now,
      ),
    ).resolves.toEqual({ status: "server-unavailable" });
  });
});
