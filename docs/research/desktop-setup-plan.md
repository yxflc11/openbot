# Research: Desktop setup intent and multi-computer plan

- Status: Implemented and verified in hosted CI
- Date: 2026-09-05
- Owner: @yxflc11
- Related issue: N/A; stacked after pull request #9
- Acceptance journey: On first launch, a user chooses one of the four documented OpenBot
  compositions, records a bounded number of planned Worker computers, sees what this Desktop will
  do and what remains pending, restarts the application, and resumes the same plan before any
  Server, Worker Host, enrollment, or privileged installer side effect occurs.
- Security boundary: The plan is local public intent, not Server authority, a capability, an
  enrollment token, proof that a service is installed, or permission to start one. The main process
  strictly validates and atomically persists it; the packaged renderer receives only typed plan
  operations. Invalid, oversized, linked, exposed, or unknown configuration fails closed. This
  slice performs no process launch, privilege escalation, service mutation, network request, or
  enrollment.

## Search evidence

- Search date: 2026-09-05
- GitHub queries: `statelyai xstate v5 latest release`, `react-hook-form latest release`, XState
  `5.31.1` release/source/tests/issues, and React Hook Form `7.77.0` release/source/tests/issues.
- Standards and primary documentation queries: React 19 state-structure guidance; W3C WAI-ARIA
  Authoring Practices radio-group pattern and visible naming guidance; Electron 44 context
  isolation, context bridge, IPC sender validation, and packaged local content guidance.
- Existing OpenBot issue, ADR, and reuse-ledger entries checked: `docs/ROADMAP.md`,
  `docs/TECHNOLOGY.md`, `docs/ARCHITECTURE.md`, `docs/EXECUTION_PLAN.md`, ADR-0041, ADR-0042,
  Desktop application/local-content/Server-connection research, the Desktop rows in both reuse
  ledgers, and the Worker Host service/installer rows for Linux, Windows, and macOS.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Existing React state plus native `fieldset`, `legend`, radio, number, and button controls | React `19.2.8`; WAI-ARIA APG `7e4034b2` | MIT; W3C Software and Document License | React is already locked and tested in OpenBot. APG documents radio keyboard behavior while recommending native semantics where possible. | One discriminated setup state and one bounded count can be derived without duplicate state. Native controls retain browser keyboard and form behavior in Web and Desktop. | Select for the renderer. Copy no APG example source. |
| Existing typed Electron context bridge plus strict local configuration store | Electron `44.2.0`; `write-file-atomic` `8.0.0` | MIT; ISC | Both are already pinned, packaged, tested, and present in the reuse ledger. | Adds two setup-plan operations without exposing raw IPC or filesystem access. The existing no-follow, POSIX-mode, size, canonical-parse, atomic-write, and reread rules fit public setup intent. | Select and generalize only the existing restricted JSON file adapter. |
| XState | `5.31.1` | MIT | Active project with 490 releases, source tests, actors, inspection tooling, and a current v5 release on 2026-05-10. | Strong fit for a long-running concurrent installer machine, but the present persisted plan has no process, rollback, or concurrent installer state. Adding an actor runtime now would widen the packaged closure before it closes a gap. | Reject for the intent slice; reconsider when one cross-platform installer transaction coordinates real service effects. |
| React Hook Form | `7.77.0` / `5b20741` | MIT | Active project with 600+ releases and current form, field-array, subscription, and validation tests. | Useful for large dynamic forms, but four radio choices and one bounded number already use native validation and existing React state. It would not protect main-process persistence or service authority. | Reject for this narrow form. |
| Persist the plan in renderer storage | Browser storage APIs in Electron `44.2.0` | MIT | Stable browser APIs. | Renderer storage weakens the existing Desktop contract, can be cleared with the authenticated Session, and cannot enforce the no-follow file policy. It also makes later service adapters trust renderer-controlled state. | Reject. |
| Start installing services directly from the first mode screen | Existing Linux, Windows, and macOS service research baselines | Mixed platform and dependency terms recorded in the reuse ledger | Platform contracts exist, but signed artifacts, privilege mediation, rollback, real-device evidence, and a common Desktop adapter are not yet complete. | A mode choice is not authority to execute a privileged installer. Treating a plan as completion would create false status and platform claims. | Reject in this slice; consume the plan only after a separately reviewed effectful adapter. |

## Reuse decision

- Selected option: existing open semantics and released dependencies, followed by a narrow local
  adapter for the OpenBot-specific plan schema and checklist projection.
- Selected upstream or standard: React `19.2.8`, WAI-ARIA APG `7e4034b2`, Electron `44.2.0`, and
  `write-file-atomic` `8.0.0`.
- Why this is the first viable option: every selected runtime is already shipped and reviewed; the
  remaining gap is OpenBot's four compositions, bounded Worker count, strict intent persistence,
  and honest derived readiness text. No state-machine or form dependency supplies that product or
  authority model.
- Exact OpenBot-specific gap: define a versioned mode/count/local-Worker schema; persist it outside
  the renderer; expose only typed read/save operations; derive a deterministic checklist in which
  `planned` never means `installed`, `connected`, `enrolled`, `authorized`, or `supported`.
- Upgrade, replacement, or exit plan: a later schema version must migrate explicitly in the main
  process. A future installer state machine may replace the local derivation only when effectful
  service transactions need recovery and concurrency. The v1 intent remains readable until an
  explicit migration is reviewed.
- Failure behavior when the upstream is missing, incompatible, or compromised: packaged startup or
  validation fails closed; no plan is inferred, no service starts, and the user returns to the
  mode screen. There is no renderer-storage or default-install fallback.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: public React, Electron, WAI-ARIA APG, and `write-file-atomic` APIs
  and documentation only. No XState, React Hook Form, or APG example source is incorporated.
- Required copyright or license notice location: existing React, Electron, and
  `write-file-atomic` notices remain in `THIRD_PARTY_NOTICES.md`; no new distributed dependency or
  notice is added.

## Verification plan

- Automated tests: strict schema and canonical round trip; every mode invariant; count bounds;
  deterministic checklist size/order; restricted-file create/load/replace; typed preload bounds;
  exact main-frame IPC sender; first-run mode gate; restart/reload; mode-specific continuation to
  the existing Server flow; and unchanged Web behavior.
- Negative and fail-closed tests: unknown fields/modes, non-integer or excess counts, contradictory
  local-Worker choices, oversized/malformed/link/exposed files, forged IPC sender, bridge failure,
  and assertions that plan creation makes no Server request or service claim.
- Platforms and devices: pure and renderer tests locally; Windows, macOS, and Linux hosted package
  jobs. These prove only portable build/test behavior. Real service effects remain outside this
  slice.
- User-visible documentation and translations: update the technology baseline, roadmap, and both
  reuse/research indexes in English and Simplified Chinese where a paired document exists.
- Support level that the evidence permits: experimental setup planning only; no Server or Worker
  Host installation, pairing, platform support, signing, or release claim.

## Evidence observed

- On 2026-09-05, the focused Desktop suite passed 102 tests and the focused Web suite passed 53
  tests. Desktop and Web typechecks and repository lint also passed.
- The unsigned macOS arm64 development package built successfully and opened without the earlier
  V8 snapshot crash. Through the packaged UI, a user selected **Use and work**, entered five Worker
  computers, reviewed the derived local-plus-four-remote checklist, continued to the existing
  Server screen, quit, reopened, and recovered the same plan.
- The retained setup file was the canonical 108-byte v1 document with POSIX mode `0600`. The
  temporary real-user test plan was removed after verification.
- Pull request #10 passed the repository check, security, database, Windows Worker build-only, and
  Linux x64, Windows x64, and macOS arm64 portable package jobs. The first Windows attempt exceeded
  the existing keyring test's five-second budget by 377 ms; the unchanged failed job passed on its
  isolated rerun. This is hosted-runner evidence, not a user-device support claim.
- Every real service, privilege, enrollment, signing, update, rollback, and user-device claim
  remains pending.

## Unresolved questions

- The effectful follow-on must separately select one privilege-mediation and rollback contract per
  platform and decide whether a common installer state machine closes enough real complexity to
  justify an added dependency.
- Server bootstrap and PostgreSQL lifecycle remain a separate vertical slice from Worker Host
  enrollment, even when the same user plan asks for both.
