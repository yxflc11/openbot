// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { listAutomations } from "./destination-api";

afterEach(() => vi.unstubAllGlobals());

describe("automation API session boundary", () => {
  it("notifies the existing unauthorized handler without exposing Server error text", async () => {
    const unauthorized = vi.fn();
    window.addEventListener("openbot:unauthorized", unauthorized);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "private server diagnostic" }, { status: 401 })),
    );
    try {
      await expect(listAutomations()).rejects.toEqual(
        new ApiError("Automation request failed (401).", 401),
      );
      expect(unauthorized).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener("openbot:unauthorized", unauthorized);
    }
  });
});
