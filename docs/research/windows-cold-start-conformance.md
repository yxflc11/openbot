# Research: Windows Desktop cold-start conformance

- Status: Accepted for implementation; native Windows verification required
- Date: 2026-09-13
- Owner: @yxflc11
- Related issue: alpha.8 Windows cold-start acceptance
- Acceptance journey: After first native initialization on Windows x64, ten separate Electron process lifetimes each start the installed native Server, prove a new process identity, verify retained PostgreSQL rows and DPAPI bootstrap ciphertext, complete Owner login, then exit normally with prior children gone.
- Security boundary: The harness uses only self-made temporary directories. It never reads the interactive user's real Desktop data roots. Product runtime code is unchanged. Failures still stop this run's Electron/Server/PostgreSQL children and leave a bounded summary without publishing secrets.

## Search evidence

- Search date: 2026-09-13
- GitHub / primary docs:
  - Electron [`v44.2.0`](https://github.com/electron/electron/releases/tag/v44.2.0) and [`safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage) (Windows DPAPI; protects other logins, not same-user malware)
  - Electron ESM readiness ordering already recorded in [windows-desktop-completion.md](windows-desktop-completion.md) (no top-level `await app.whenReady()`)
  - Node.js `child_process` / `process.kill(pid, 0)` liveness; PowerShell `Start-Process` / `Process.WaitForExit` / `Kill($true)` already used by `scripts/check-windows-desktop-install.ps1`
  - PostgreSQL REL_17_11 `postmaster.pid` and `pg_ctl` restricted-token contracts already reused by Desktop
- Existing OpenBot issue, ADR, and reuse-ledger entries checked:
  - `docs/OPEN_SOURCE_REUSE.md` Windows Desktop / DPAPI / `pg_ctl` entries
  - `docs/research/windows-desktop-completion.md` installed-runtime smoke receipt
  - `apps/desktop/scripts/windows-native-smoke.mjs` same-process controller stop/start only

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Same-process `NativeServerController` stop/start ×10 | Existing OpenBot Desktop | MIT | Already in smoke | Proves retained files inside one Electron lifetime only; does **not** prove cold process identity or child teardown across OS process exits. | Reject as cold-start evidence; retain at most one same-process restart so historical assertions are not relaxed. |
| Ten independent Electron process lifetimes orchestrated by the existing PowerShell install gate | Electron 44.2.0; Node child_process; inbox PowerShell/.NET Process | MIT; Node.js; Microsoft docs | Hosted Windows CI already launches Electron for smoke | Matches product quit/reopen; can assert new PID, dead prior children, DPAPI ciphertext equality, PG row retention, Owner login. | Select. |
| Playwright / Spectron driving the packaged UI | Deferred Playwright 1.62.1 per foundation research | Apache-2.0 | Extra download/surface | Broader than alpha.8 native runtime gate; not required to prove Server/PG/DPAPI cold start. | Reject for this slice. |
| New process-supervisor dependency | n/a | n/a | n/a | Violates no-new-dependency constraint. | Reject. |

## Reuse decision

- Selected option: thin local harness gap on already-pinned Electron, Node, PowerShell, `NativeServerController`, `utilityProcess`, `safeStorage`, and Windows PostgreSQL PID contracts.
- Selected upstream or standard: Electron 44.2.0 safeStorage/DPAPI; Node process liveness; PostgreSQL `postmaster.pid`; PowerShell process wait/kill already in the install script.
- Why this is the first viable option: open standards and released APIs already in tree close the gap; only orchestration and assertions are missing.
- Exact OpenBot-specific gap: multi-lifetime smoke modes, shared self-made harness state, prior-child teardown checks, and receipt fields for ten cold starts.
- Upgrade, replacement, or exit plan: if Electron changes safeStorage async init or utilityProcess PID semantics, re-pin and re-run the Windows install gate; the helper unit tests stay portable.
- Failure behavior: bounded per-process timeouts; on failure stop this run's harness processes only after verifying recorded start-time + executable path (or a held Start-Process handle)—never bare JSON PID kills—remove harness temps when safe, keep install/uninstall assertions, and emit a short non-secret summary.

## Source incorporation

- Source copied or substantially adapted: no
- Files and upstream locations: none
- Required copyright or license notice location: n/a

## Verification plan

- Automated tests: portable Vitest for harness state/PID/receipt helpers under `apps/desktop/scripts/`; Windows CI continues to run NSIS install → smoke → uninstall.
- Negative and fail-closed tests: reject still-alive prior Electron/postgres/server identities (start time + path, not PID alone); refuse Stop-Process on identity mismatch; treat EPERM from `kill(pid,0)` as alive; reject bootstrap ciphertext drift; per-round receipts expose process identity, loginCount, and ciphertext digest only (no passwords/raw ciphertext); require fresh receipt paths; do not relax existing check inventory.
- Platforms and devices: Windows x64 hosted runner required for full evidence; Linux may run helper unit tests only.
- User-visible documentation and translations: bilingual Windows Desktop acceptance how-to.
- Support level that the evidence permits: installed native runtime cold-start conformance when CI prints the extended receipt; not SmartScreen, code signing, accessibility, or computer-control support.

## Unresolved questions

- Hosted Windows CI must still execute the ten cold-start lifetimes on this branch; Linux box evidence remains pending CI.
