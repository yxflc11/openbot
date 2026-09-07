import { EventEmitter } from "node:events";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  isPublicSourceAddress,
  normalizeSourceUrl,
  readPublicSource,
  type SourceTransport,
  taskSourceUrls,
} from "./agent-sources.js";

vi.mock("node:https", () => ({ request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

function fixture(): SourceTransport {
  return {
    resolve: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
    read: vi.fn(async () => ({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: Buffer.from("<h1>Verified title</h1><p>A useful fact.</p>"),
    })),
  };
}

describe("Server public source reader", () => {
  it("binds at most three unique explicit HTTPS sources and rejects alternate authorities", () => {
    expect(
      taskSourceUrls(
        "Read https://example.com/a#part, https://example.com/a and https://example.org/b. Then https://example.net/c https://example.edu/d",
      ),
    ).toEqual(["https://example.com/a", "https://example.org/b", "https://example.net/c"]);
    expect(
      taskSourceUrls("请阅读 https://example.com，整理报告；再看 https://example.org。"),
    ).toEqual(["https://example.com/", "https://example.org/"]);
    const credentialUrl = new URL("https://example.com");
    credentialUrl.username = "fixture-user";
    credentialUrl.password = "fixture-password";
    for (const url of [
      "file:///etc/passwd",
      "http://example.com",
      credentialUrl.href,
      "https://example.com:8443/a",
      "https://localhost/a",
      "https://service.internal/a",
      "https://example.com/\npath",
    ]) {
      expect(() => normalizeSourceUrl(url)).toThrow();
    }
  });

  it.each([
    "127.0.0.1",
    "0.0.0.0",
    "10.1.1.1",
    "172.16.1.1",
    "192.168.1.1",
    "100.64.0.1",
    "169.254.169.254",
    "192.0.0.8",
    "192.0.2.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "::127.0.0.1",
    "::8.8.8.8",
    "fc00::1",
    "fe80::1",
    "fec0::1",
    "64:ff9b::7f00:1",
    "2002:7f00:1::",
    "2001:db8::1",
    "ff02::1",
    "fe80::1%en0",
    "127.1",
    "0177.0.0.1",
    "0x7f000001",
  ])("rejects private, reserved, mapped or noncanonical address %s", (address) => {
    expect(isPublicSourceAddress(address)).toBe(false);
  });

  it("allows reviewed public unicast addresses and rejects mixed DNS before connecting", async () => {
    expect(isPublicSourceAddress("93.184.216.34")).toBe(true);
    expect(isPublicSourceAddress("2606:4700:4700::1111")).toBe(true);
    const io = fixture();
    vi.mocked(io.resolve).mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(
      readPublicSource("https://example.com", new AbortController().signal, io),
    ).rejects.toThrow("exclusively public");
    expect(io.read).not.toHaveBeenCalled();
    await expect(
      readPublicSource("https://2130706433", new AbortController().signal, io),
    ).rejects.toThrow("exclusively public");
    expect(io.read).not.toHaveBeenCalled();
  });

  it("extracts text without executing or retaining scripts, styles, images and remote frames", async () => {
    const io = fixture();
    vi.mocked(io.read).mockResolvedValue({
      status: 200,
      contentType: "text/html",
      body: Buffer.from(
        '<h1>资料</h1><p>Useful &amp; bounded.</p><script>private script</script><style>private CSS</style><iframe src="https://other.example">frame text</iframe><img src="http://127.0.0.1/private"><a href="javascript:evil()">a link</a>',
      ),
    });
    const result = await readPublicSource(
      "https://example.com/source",
      new AbortController().signal,
      io,
    );
    expect(result.text).toContain("Useful & bounded.");
    expect(result.text).not.toMatch(/private|frame text|127\.0\.0\.1|javascript/u);
    expect(result.url).toBe("https://example.com/source");
    expect(io.resolve).toHaveBeenCalledTimes(1);
    expect(io.read).toHaveBeenCalledWith(
      new URL(result.url),
      { address: "93.184.216.34", family: 4 },
      expect.any(AbortSignal),
    );
  });

  it("bounds text by UTF-8 bytes and rejects redirects, compression, binaries, excess bytes and invalid UTF-8", async () => {
    const io = fixture();
    vi.mocked(io.read).mockResolvedValue({
      status: 200,
      contentType: "text/plain",
      body: Buffer.from("中".repeat(5000)),
    });
    const result = await readPublicSource("https://example.com", new AbortController().signal, io);
    expect(Buffer.byteLength(result.text)).toBeLessThanOrEqual(6000);
    expect(result.text).not.toContain("�");
    expect(result.truncated).toBe(true);
    for (const changed of [
      { status: 302 },
      { contentEncoding: "gzip" },
      { contentType: "application/pdf" },
      { body: Buffer.alloc(512 * 1024 + 1) },
      { body: Buffer.from([0xff]) },
    ]) {
      vi.mocked(io.read).mockResolvedValue({
        status: 200,
        contentType: "text/plain",
        body: Buffer.from("text"),
        ...changed,
      });
      await expect(
        readPublicSource("https://example.com", new AbortController().signal, io),
      ).rejects.toThrow();
    }
  });

  it("cancels even a stuck DNS resolver before it can connect", async () => {
    const io = fixture();
    vi.mocked(io.resolve).mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();
    const pending = readPublicSource("https://example.com", controller.signal, io);
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(io.read).not.toHaveBeenCalled();
  });

  it("connects to the validated numeric address while retaining original Host and TLS identity", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    const response = Object.assign(Readable.from([Buffer.from("safe source")]), {
      statusCode: 200,
      headers: { "content-type": "text/plain" },
    });
    const outgoing = Object.assign(new EventEmitter(), { end: vi.fn() });
    vi.mocked(request).mockImplementation(((
      url: URL,
      options: unknown,
      receive: (value: unknown) => void,
    ) => {
      expect(url.hostname).toBe("example.com");
      expect(options).toMatchObject({
        hostname: "93.184.216.34",
        servername: "example.com",
        agent: false,
        method: "GET",
        rejectUnauthorized: true,
        headers: { Host: "example.com", "Accept-Encoding": "identity" },
      });
      expect(options).not.toHaveProperty("auth");
      outgoing.end.mockImplementation(() => receive(response));
      return outgoing;
    }) as typeof request);
    const result = await readPublicSource(
      "https://example.com/research",
      new AbortController().signal,
    );
    expect(result.text).toBe("safe source");
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
