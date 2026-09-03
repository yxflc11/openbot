# ADR-0017: Server-owned assignments and bounded Node connections

- Status: Accepted
- Date: 2026-09-04

## Context

Worker Hosts connect to the OpenBot Server over one outbound WebSocket and report their declared
capabilities, local activity, progress, and results. A retrospective open-source review found that
the first protocol slice inherited unsafe transport defaults and blurred one authority boundary:

1. `ws` accepted messages up to its 100 MiB default and the Node client enabled compression by
   default;
2. a connection could remain open without enrolling, enroll more than once, or remain registered
   after the network path stopped carrying data;
3. a heartbeat replaced the Server's in-memory `activeRunIds`, allowing a Worker Host to alter the
   capacity and assignment projection that routing relies on; and
4. the deployment-wide enrollment token authenticates possession of one shared secret, not a
   durable per-Node identity.

The Server must remain the source of truth for routing and authorization even when a Worker Host is
buggy or compromised. Liveness reports can inform that authority but cannot replace it.

## Upstream review

- [`ws` 8.21.3 (`c791e707`)](https://github.com/websockets/ws/tree/c791e707eab3c13dd9a261d2479c3cc4a49a6fed)
  (MIT) documents the `maxPayload` and `perMessageDeflate` options and its ping/pong termination
  pattern for broken connections. OpenBot uses those released public options instead of creating a
  WebSocket transport.
- [Kubernetes node-heartbeat KEP at `e849163a`](https://github.com/kubernetes/enhancements/blob/e849163ac4a0a5241ba626bd9a99820bf1dcd279/keps/sig-node/589-efficient-node-heartbeats/README.md)
  (Apache-2.0) separates a lightweight liveness lease from broader Node status. OpenBot adopts the
  separation of liveness from authoritative scheduling state, not its API or source.
- [Nomad at `482b49bf`](https://github.com/hashicorp/nomad/tree/482b49bf1aec006f089bcfc7e632d8f6ac303e5e)
  (MPL-2.0) keeps allocation desired state with servers while clients run allocations and report
  observed execution state. OpenBot follows this authority split without copying Nomad code.
- [SPIFFE at `99470b9a`](https://github.com/spiffe/spiffe/tree/99470b9abc825f14aa364dfa2c3b53b02ba5db5b)
  (Apache-2.0) and [Tailscale at `92ec1026`](https://github.com/tailscale/tailscale/tree/92ec102673bf46d72bab64b0a278b93c01a47f34)
  (BSD-3-Clause) were reviewed as proof-of-possession identity models. They are future integration
  candidates, not dependencies in this slice.

No upstream source was copied or substantially adapted.

## Decision

1. Reuse `ws` and explicitly disable per-message compression on both ends. The Server accepts at
   most 32 MiB per Node message instead of the library's 100 MiB default; the Node accepts at most
   1 MiB per Server control message.
2. The 32 MiB temporary envelope preserves the current protocol's worst-case completion message:
   four inline base64 artifacts of up to 7,000,000 characters plus metadata. Artifact uploads must
   move out of band before this bound can be reduced further.
3. A socket must send one valid `node.hello` within 10 seconds. A second hello on the same socket is
   a protocol violation and closes that connection; it cannot reset assigned Runs or capacity.
4. Every 30 seconds the Server pings each connection. A connection that has not answered the
   previous ping is terminated, which triggers the existing disconnect and Run-recovery path.
   Socket errors also terminate the connection instead of becoming unhandled EventEmitter errors.
5. `node.heartbeat` updates liveness metadata only. Its reported `activeRunIds` remains useful
   observed state for a future reconciliation protocol, but it cannot add, remove, or settle the
   Server's assignment records. Only Server assignment, settlement, cancellation, and disconnect
   paths change routing capacity.
6. The shared deployment token remains a development bootstrap secret. It can neither prevent one
   enrolled host from impersonating another Node ID nor support per-Node revocation. OpenBot must
   not describe this channel as mTLS or production Node identity until a separately reviewed,
   persisted enrollment and rotation design is implemented.

## Consequences

- Slow or dead network paths no longer leave a Worker Host indefinitely available for routing.
- An unauthenticated socket has a fixed lifetime and incoming Node messages have a fixed memory
  envelope.
- A compromised Worker Host can report false observed state, but it cannot free its Server-owned
  task slots by sending an empty heartbeat.
- Replacing a live socket still uses the deployment token and claimed Node ID, so this slice is
  suitable only for trusted private-network testing.
- The protocol still needs one-time enrollment, per-Node proof-of-possession keys, rotation,
  revocation, replay protection, and persisted reconciliation before production remote deployment.
