# Research: Owner Node management console

- Status: Accepted for implementation
- Date: 2026-09-04
- Owner: @yxflc11
- Related issue: not filed yet
- Acceptance journey: an authenticated Owner opens the existing Node control, sees enrolled hosts
  whether online or offline, generates one short-lived pairing value, copies it once, and can revoke
  one host without affecting another.
- Security boundary: the Server remains authoritative; plaintext bootstrap values are returned once
  and never re-listed; only an Owner may issue or revoke; a public Node may only exchange a valid
  token; listing must never expose credential digests.

## Search evidence

- Search date: 2026-09-04
- GitHub queries: `Headplane machines pre-auth keys expire UI`, `Headscale UI devices preauth key`,
  `Tailscale admin auth key machine management`.
- Standards and primary documentation queries: Headscale 0.29 pre-auth key security and registration
  changelog; Tailscale auth-key and machine-state source/issues; WAI-ARIA dialog and status patterns
  already reviewed for OpenBot's existing modal system.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: ADR-0016, ADR-0017, ADR-0023,
  `OPEN_SOURCE_REUSE.md`, existing native dialog hook, Sidebar Node control, Workspace realtime Node
  projection, and current Owner session middleware.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Headplane | [`v0.7.0`](https://github.com/tale/headplane/tree/v0.7.0) | MIT | Active TypeScript project with machine management, releases, and security fixes | Strong behavioral reference, but its Headscale/OIDC/backend contracts cannot become OpenBot's Server | Reuse the devices-list, explicit add flow, status, and destructive action separation as product behavior; do not copy code |
| Headscale | [`v0.29.3`](https://github.com/juanfont/headscale/tree/v0.29.3) | BSD-3-Clause | Mature control plane with API and migration coverage | Strong one-time key lifecycle and machine-state reference; wrong runtime and data model for embedding | Keep as protocol and state-lifecycle reference behind ADR-0023 |
| Tailscale | [`92ec1026`](https://github.com/tailscale/tailscale/tree/92ec102673bf46d72bab64b0a278b93c01a47f34) | BSD-3-Clause | Mature cross-platform client and control protocol | Strong separation between auth key and durable machine state; hosted admin UI is not reusable here | Reuse the lifecycle concepts only |
| Headscale UI | [`2026.03.17`](https://github.com/gurucomputing/headscale-ui/tree/2026.03.17) | BSD-3-Clause | Public UI with releases, but open duplicate-create/offline-state issues | Similar screens but less suitable behavior and a separate stack | Reject |
| Existing OpenBot modal/API stack | Current branch | MIT | Native dialog, Owner middleware, strict input schemas, realtime online state, and test harness already present | Exact visual, authorization, and data-model fit | Extend only the missing persisted identity list and management dialog |

## Reuse decision

- Selected option: local gap using existing OpenBot components, informed by compatible upstream
  behavior.
- Selected upstream or standard: Headplane's device-management journey, Headscale/Tailscale's
  bootstrap-versus-machine-state separation, and the already reviewed native HTML dialog contract.
- Why this is the first viable option: no standalone component or API can safely manage OpenBot's
  Server-owned identity rows; importing another control plane would duplicate authority. The
  existing modal, fetch wrapper, Node projection, and Owner middleware already solve all generic
  mechanics.
- Exact OpenBot-specific gap: list safe persisted Node identity metadata, merge online state without
  exposing digests, and connect issue/revoke commands to the existing Nodes navigation control.
- Upgrade, replacement, or exit plan: keep the UI against narrow OpenBot API types. A future
  proof-of-possession identity adapter may change credential internals without changing the list,
  issue, copy-once, and revoke journey.
- Failure behavior when the upstream is missing, incompatible, or compromised: no runtime upstream
  is introduced. API failures leave the dialog state unchanged and show an Owner-visible error;
  failed revocation never removes a row optimistically.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: only public product behavior and documented lifecycle concepts are
  referenced; implementation uses existing OpenBot source.
- Required copyright or license notice location: none beyond links in this record and the reuse
  ledger.

## Verification plan

- Automated tests: identity service/store list projection; authenticated list/issue/revoke API;
  dialog loading, copy-once result, online/offline projection, and revocation confirmation.
- Negative and fail-closed tests: anonymous list/issue/revoke denied; no digest fields in JSON;
  failed issue/revoke retains current records and reports the error; double-submit disabled.
- Platforms and devices: responsive Web contract with simulated Windows, macOS, and Linux identity
  metadata; this does not certify native Providers.
- User-visible documentation and translations: root status, API docs, Node enrollment runbook, and
  reuse ledger in English and Simplified Chinese.
- Support level that the evidence permits: integrated Owner management workflow; Node credentials
  remain development/private-network only under ADR-0023.

## Unresolved questions

- Native proof-of-possession and keyring status will need additional fields after their own upstream
  review; this slice must not pre-invent those states.
