# Research: explicit Node environment credential opt-in

- Status: Accepted for implementation
- Date: 2026-09-11
- Owner: @yxflc11
- Related finding: DEV-002 H3
- Acceptance journey: ordinary Node enrollment restores its configured credential store; an inherited bearer cannot override it silently.
- Security boundary: Server enrollment/revocation remains authoritative. This configuration guard does not turn bearer credentials into proof of possession.

## Search evidence

Searched GitHub for `colinhacks/zod environment variables superRefine v4` and the OWASP Secrets Management primary documentation. Reviewed existing `OPEN_SOURCE_REUSE.md` entries for Node bootstrap, Linux Secret Service and strict configuration. Inspected current Node schema/client, service profiles and Windows launch allowlist.

| Candidate | Exact version | License | Maintenance, tests and fit | Decision |
| --- | --- | --- | --- | --- |
| Existing Zod configuration validation | 4.5.4, e8e206fa33ac5fe7ce20a2beb12d57b1cb3df653 | MIT | Released 2026-08-29; inspected `packages/zod/src/v4/classic/tests/refine.test.ts` and LICENSE. Open issues 6589/6588/6586 concern documentation, performance and recursive views, not this existing refinement path. Already used on all Node platforms. | Reuse exact installed dependency; no new wrapper. |
| Existing bootstrap and native stores | Existing OpenBot adapters, with upstream versions recorded in the reuse ledger | Existing notices | Enrollment and file/Secret Service/macOS Host boundaries already exist. PKI or a new secret-manager deployment would expand this configuration repair into a different identity architecture. | Preserve; do not bypass a selected keyring with environment input. |

Primary sources: [Zod release](https://github.com/colinhacks/zod/releases/tag/v4.5.4), [pinned refinement tests](https://github.com/colinhacks/zod/blob/e8e206fa33ac5fe7ce20a2beb12d57b1cb3df653/packages/zod/src/v4/classic/tests/refine.test.ts), [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html). OWASP describes secret lifecycle and environment-injection risks; OpenBot chooses the exact opt-in policy below.

## Reuse decision

Reuse strict boolean parsing and Zod cross-field refinements. Reject `OPENBOT_NODE_CREDENTIAL` unless `OPENBOT_NODE_ALLOW_ENV_CREDENTIAL=true`; reject environment credentials for explicit Secret Service/macOS Host stores even with opt-in. Keep an advanced, documented ephemeral file-profile injection path with a content-free startup warning. Repeat the guard at the actual credential-use boundary, including for programmatic clients. Do not log credentials, migrate secret data, or silently fall back. Normal enrollment/storage needs no new option. Windows Host forwards the explicit option alongside the existing credential. Linux smoke fixtures explicitly opt in.

## Source incorporation

No upstream source copied or substantially adapted. No dependency or wire-protocol changes; existing MIT dependency notices remain intact.

## Verification

Test default rejection, invalid boolean values, explicit ephemeral opt-in, keyring override rejection, and runtime refusal without store/network access. Existing real WebSocket client tests continue with explicit test-only opt-in; assert the warning contains no credential. Run `npm run check`, then existing native CI. Update English/Chinese enrollment and reuse documentation. H3 remains partially open until a separately reviewed non-copyable identity protocol exists; this change only closes silent environment credential use.
