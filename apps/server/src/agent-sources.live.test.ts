import { describe, expect, it } from "vitest";
import { readPublicSource } from "./agent-sources.js";

// Opt-in network acceptance: ordinary offline tests must not depend on public-site availability.
describe.skipIf(process.env.OPENBOT_LIVE_SOURCE_TEST !== "1")("live public HTTPS source", () => {
  it("reads the fixed public example page through real DNS, pinned TLS and bounded extraction", async () => {
    const page = await readPublicSource("https://example.com/", AbortSignal.timeout(20000));
    expect(page.url).toBe("https://example.com/");
    expect(page.text).toContain("Example Domain");
    expect(Buffer.byteLength(page.text)).toBeGreaterThan(20);
    expect(Buffer.byteLength(page.text)).toBeLessThanOrEqual(6000);
    expect(Number.isFinite(Date.parse(page.fetchedAt))).toBe(true);
    console.info(
      JSON.stringify({
        acceptance: "live-public-source",
        url: page.url,
        textBytes: Buffer.byteLength(page.text),
        truncated: page.truncated,
      }),
    );
  }, 25000);
});
