# ADR-0019: Reject ambiguous or unbounded Node protocol inputs

- Status: Accepted
- Date: 2026-09-04

## Context

The Worker Host channel crosses a trust boundary. Its earlier Zod objects validated known fields but
silently removed unknown fields, accepted unbounded Node names and identifiers, allowed duplicate
capabilities, and accepted arbitrary nested approval evidence. Configuration also allowed a remote
unencrypted WebSocket URL and very short shared enrollment secrets.

Those behaviors make malformed-version failures ambiguous and let an untrusted or compromised Node
consume disproportionate validation, audit, or storage resources. The shared enrollment secret is
still only a pre-alpha deployment credential, but accepting obvious sample or low-entropy values
would make the current boundary weaker than its documentation.

## Upstream review

- [Zod 4.5.4 `e8e206fa`](https://github.com/colinhacks/zod/tree/e8e206fa33ac5fe7ce20a2beb12d57b1cb3df653)
  (MIT) is already OpenBot's released schema dependency. Its strict object mode and built-in string,
  array, enum, URL, and refinement validators cover the wire-shape requirements without another
  protocol package.
- [OWASP Cheat Sheet Series `b8586414`](https://github.com/OWASP/CheatSheetSeries/tree/b8586414a5c47ae68911edb97d4e7b7bc6301035)
  (documentation under CC BY-SA 4.0) recommends allowlisting, semantic validation, and explicit
  length and range limits for untrusted input.
- [Model Context Protocol TypeScript SDK `5119ee7f`](https://github.com/modelcontextprotocol/typescript-sdk/tree/5119ee7fd7790e335a3fb60ef36f85334e2a6326)
  (MIT) was reviewed as protocol-validation prior art. OpenBot does not adopt its transport because
  the Node channel has different assignment and authority semantics.

No upstream source or documentation was copied or substantially adapted.

## Decision

1. Advance the pre-alpha Node wire contract to `0.8.0`. All message envelope objects reject unknown
   fields rather than silently discarding them.
2. Restrict Node identifiers to 1–128 stable ASCII characters and Node names to 160 characters.
   Capability lists are bounded by the enum and reject duplicates.
3. Bound enrollment secrets to 32–4,096 characters and reject the repository's example value.
   This is input hygiene, not a claim of per-Node identity or entropy verification.
4. Allow `ws:` only for loopback development. A configured non-loopback Server URL must use `wss:`.
   mTLS and one-time per-Node enrollment remain required before untrusted-network deployment.
5. Approval `beforeState` remains JSON-shaped evidence, but is limited to 256 values, six composite
   levels, 32 fields per object, 64 items per array, 80-character keys, and 4,096-character strings.
6. Keep DSSE envelopes as specification-shaped passthrough objects. Their payload is separately
   size-bounded, signature-verified, and strictly parsed as an Employee package after verification;
   adding OpenBot-only fields to the standard envelope would reduce interoperability.

## Consequences

- An older Node or Server cannot communicate with the `0.8.0` peer. Pre-alpha deployments must
  upgrade both sides together.
- Malformed extensions now fail clearly instead of being accepted with fields removed.
- Remote plaintext Worker Host configuration fails before a connection is attempted.
- Evidence that exceeds the audit boundary must be summarized or stored as a separately governed
  artifact rather than embedded in an approval message.
- The deployment-wide token remains unsuitable for production identity, rotation, revocation, or
  replay protection.
