# ADR-0029: Bind durable login throttling to a trusted network identity

- Status: Accepted
- Date: 2026-09-04

## Context

Owner login failures were counted in one process-local map keyed by browser Origin. Every browser
at the same deployment Origin shared a bucket, concurrent Server instances did not share state, and
a restart cleared failures. Origin authenticates a browser request's web origin; it is not a remote
client identity.

OpenBot must work directly and behind an explicitly configured reverse proxy. Forwarding headers
are attacker-controlled unless the direct peer is that trusted proxy. The throttle must remain
atomic under concurrent attempts, survive restart, avoid storing raw network addresses, and fail
closed if its durable authority is unavailable.

## Upstream review

- [RFC 7239](https://www.rfc-editor.org/rfc/rfc7239) (IETF Trust) defines `Forwarded`, including
  quoted IPv6 values, `unknown`, obfuscated identifiers, and multiple proxy elements. It explicitly
  does not make header content trustworthy.
- [`@hono/node-server` `73c03adf`](https://github.com/honojs/node-server/tree/73c03adfb01928fcd5f5b20faebd5d692f83fc93)
  (MIT) exposes the direct Node socket address through `getConnInfo`.
- [OWASP Authentication Cheat Sheet `b8586414`](https://github.com/OWASP/CheatSheetSeries/blob/b8586414a5c47ae68911edb97d4e7b7bc6301035/cheatsheets/Authentication_Cheat_Sheet.md)
  (CC BY-SA 4.0 documentation) recommends login throttling, account-aware counters, bounded
  thresholds/windows, and consideration of lockout denial of service.
- NIST [SP 800-63B-4](https://doi.org/10.6028/NIST.SP.800-63B-4) (public-domain U.S. government work)
  requires rate limiting and a 15-character minimum for single-factor passwords while rejecting
  arbitrary composition rules.
- [PostgreSQL 17 `ec3f6a6a`](https://github.com/postgres/postgres/tree/ec3f6a6a7dd82a8ce455a0710ef75172f9f318d1)
  (PostgreSQL License) provides transaction-level advisory locks and atomic upsert semantics.
- `hono-rate-limiter` (`d593af13`, MIT) and `express-rate-limit` (`c8b3c7ff`, MIT) were reviewed.
  Neither can establish the proxy trust contract, and the latter targets Express.

## Reuse decision

Reuse Hono's direct peer observation, RFC 7239 parsing rules, and the existing required PostgreSQL
authority. Implement the OpenBot-specific strict single-hop trust and pseudonymous bucket adapter
locally. Do not add generic rate-limit middleware that would still depend on an unverified key.

## Source incorporation

No upstream source or documentation is copied or substantially adapted. Standards define the trust
and password requirements; local code implements the bounded deployment contract.

## Verification plan

- Parser tests cover normalized IPv4/IPv6, direct mode, a trusted proxy, spoofed forwarding from an
  untrusted peer, multiple hops, `unknown`, obfuscated values, malformed quotes, and missing peers.
- Store tests cover the attempt threshold, window reset, successful-login reset, database failure,
  restart persistence, and concurrent attempts.
- HTTP tests prove login uses peer identity instead of Origin and that the enrollment audit stores
  only a digest/source classification.
- PostgreSQL verification exercises the new migration and atomic transition.
- English and Chinese configuration/security/Node enrollment docs describe direct and proxy modes.

## Decision

1. The Node socket's canonical IP address is the default client identity.
2. One optional `OPENBOT_TRUSTED_PROXY_ADDRESS` may name an exact IP. Only when the direct peer
   equals it may the Server accept `Forwarded`; the header must contain exactly one element and one
   canonical IP `for` value. Malformed, multi-hop, obfuscated, or `unknown` values fail closed.
3. Forwarding headers from any other peer are ignored. They never override the direct address.
4. The Server stores and logs only a domain-separated SHA-256 digest and a `direct` or `forwarded`
   source label, never the raw client address.
5. PostgreSQL serializes each login bucket. Five failures in a five-minute window cause a
   five-minute block; success clears the bucket. A store error rejects login.
6. The deployment Owner is the only login account, so the bucket combines that stable account with
   the pseudonymous client identity. A future multi-account model must add an account dimension.
7. The single-factor environment password minimum is 15 characters. No composition rule is added.

## Consequences

- Restarts and horizontal Server processes no longer erase or split login failure state.
- Operators behind a proxy must configure its exact direct IP; load-balanced/multi-hop proxy trust
  needs a separate allowlist and authenticated topology design.
- Direct-peer IPs can be shared by NAT users and can change. Throttling remains abuse resistance,
  not human or device identity.
- Digesting a small address space is pseudonymization, not anonymization. Database access controls
  and retention still matter.
- Compromised-password screening and lockout notification remain future work.
