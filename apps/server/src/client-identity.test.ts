import { describe, expect, it } from "vitest";
import {
  canonicalIpAddress,
  ClientIdentityError,
  resolveClientIdentity,
} from "./client-identity.js";

describe("client network identity", () => {
  it("normalizes direct IPv4 and IPv6 addresses into stable opaque digests", () => {
    const ipv4 = resolveClientIdentity({ remoteAddress: "192.0.2.10", forwarded: undefined });
    const ipv6 = resolveClientIdentity({
      remoteAddress: "2001:0db8:0000:0000:0000:0000:0000:0001",
      forwarded: undefined,
    });

    expect(ipv4).toMatchObject({
      source: "direct",
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(ipv4.digest).not.toContain("192.0.2.10");
    expect(canonicalIpAddress("2001:db8::1")).toBe("2001:db8::1");
    expect(ipv6.digest).toBe(
      resolveClientIdentity({ remoteAddress: "2001:db8::1", forwarded: undefined }).digest,
    );
  });

  it("ignores spoofed forwarding metadata from an untrusted direct peer", () => {
    expect(
      resolveClientIdentity({
        remoteAddress: "192.0.2.10",
        forwarded: "for=203.0.113.4",
        trustedProxyAddress: "192.0.2.11",
      }),
    ).toEqual(resolveClientIdentity({ remoteAddress: "192.0.2.10", forwarded: undefined }));
  });

  it("accepts one canonical address from the exact trusted proxy", () => {
    const identity = resolveClientIdentity({
      remoteAddress: "192.0.2.11",
      forwarded: 'for="[2001:db8::8]";proto=https',
      trustedProxyAddress: "192.0.2.11",
    });

    expect(identity.source).toBe("forwarded");
    expect(identity.digest).toBe(
      resolveClientIdentity({ remoteAddress: "2001:db8::8", forwarded: undefined }).digest,
    );
  });

  it.each([
    undefined,
    "",
    "for=unknown",
    "for=_hidden",
    "for=192.0.2.1:1234",
    "for=192.0.2.1, for=192.0.2.2",
    "for=192.0.2.1;for=192.0.2.2",
    'for="[2001:db8::1]\\"',
  ])("fails closed for ambiguous trusted-proxy metadata: %s", (forwarded) => {
    expect(() =>
      resolveClientIdentity({
        remoteAddress: "192.0.2.11",
        forwarded,
        trustedProxyAddress: "192.0.2.11",
      }),
    ).toThrow(ClientIdentityError);
  });

  it("fails closed without a valid direct peer", () => {
    expect(() => resolveClientIdentity({ remoteAddress: undefined, forwarded: undefined })).toThrow(
      ClientIdentityError,
    );
    expect(() =>
      resolveClientIdentity({ remoteAddress: "client.example", forwarded: undefined }),
    ).toThrow(ClientIdentityError);
  });
});
