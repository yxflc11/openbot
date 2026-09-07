# Research: Desktop cross-platform handoff

- Status: Accepted
- Date: 2026-09-07
- Owner: @yxflc11
- Acceptance journey: first launch offers a usable role on the current OS, and reviewers can
  download the exact unsigned Desktop bundle built by each hosted CI lane.
- Security boundary: role presentation never grants execution authority. Only the existing macOS
  native controller may start app-owned services. CI publishes generated bundles, never profiles.

## Search evidence

- Search date: 2026-09-07.
- GitHub queries: `actions/upload-artifact v7 archive permissions tar` and
  `electron electron v44.2.0 process platform`.
- Primary documentation: [Electron process](https://www.electronjs.org/docs/latest/api/process),
  [process model](https://www.electronjs.org/docs/latest/tutorial/process-model), and
  [GitHub artifact storage](https://docs.github.com/en/actions/tutorials/store-and-share-data).
- Existing reviews checked: Desktop foundation, integrated onboarding, Linux archive distribution,
  both reuse ledgers, current CI, `NativeServerController`, the preload runtime bridge and setup UI.
- The current UI always offers native host setup, but the controller rejects non-macOS hosts.
  CI already packages Linux x64, Windows x64 and macOS arm64, then discards those bundles.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Existing Electron runtime bridge | [44.2.0](https://github.com/electron/electron/releases/tag/v44.2.0) | MIT | Source, tests and issues reviewed in the foundation record; existing preload exposes immutable platform metadata | Uses runtime OS rather than browser user-agent guessing, without a new IPC capability | Reuse |
| GitHub artifact action | [7.0.1 / 043fb46d](https://github.com/actions/upload-artifact/tree/043fb46d1a93c77aae656e7c1c64a875d1fc6a0a) | MIT | Maintained official action with source, tests and issue tracker; already pinned for Linux release uploads | Direct single-file upload preserves archive bytes; tar retains executable modes and internal symlinks that ordinary artifact directory upload loses | Reuse |
| New platform framework or publishing service | None selected | Not applicable | No additional candidate is needed for this gap | Existing reviewed runtime and hosted artifact service cover both requirements | Do not add a dependency |

## Reuse decision

Use the existing runtime metadata to offer local service setup only on macOS; other platforms
start with the remote connection path. Unknown platform metadata also omits native setup.
The native controller remains authoritative and rejects unsupported platforms independently.
Use each runner's tar to archive only its generated `OpenBot-<platform>-<arch>` directory, and
upload it through the already pinned artifact action with seven-day retention and exact commit
identity. This is temporary development distribution, not signing, notarization, an installer,
update support, reproducibility certification, or native desktop-control evidence.

The narrow OpenBot gap is role presentation and connecting an existing package output to CI
artifact transport. A failed packaging/check step must prevent artifact upload. Keep the existing
sandbox, ASAR validation, strict fuses and macOS companion validation unchanged.

## Source incorporation

No upstream source is copied or substantially adapted. Existing dependency notices remain in
`THIRD_PARTY_NOTICES.md`; no dependency or production permission is added.

## Verification plan

- Regression tests for macOS choice and Windows/Linux/unknown-platform first launch, including
  a stale saved host plan; verify submitting the default selects remote client with no Worker grant.
- `npm run check`, native macOS package validation and all three hosted CI package jobs.
- Upload only after each lane's existing platform checks; fail on a missing archive.
- Run the existing PostgreSQL automation transaction suite in the database lane against a newly
  created disposable test database, using the reviewed PostgreSQL 17.11 service and postgres 3.4.9
  client already used by CI. This exercises the pending Server changes without touching user data.
- Update English and Chinese Desktop docs and all maintained root README translations.
- Claims stay at unsigned development bundles / tested contracts. Real-device control and signed
  public installers remain separate acceptance gates.

## Hosted follow-up

The first PR run exposed a native bootstrap fixture that spoofed macOS on Windows while retaining
Windows filesystem semantics. The controller correctly rejected POSIX ownership/mode evidence
before reaching encryption. Keep that encryption prerequisite check explicitly POSIX-only and
exercise pending-request deduplication on all three platforms without spoofing filesystem proof.
Production directory checks and unsupported-platform rejection remain unchanged.

The second Windows run passed tests and Electron packaging, then exposed GNU tar's interpretation
of a drive-letter archive path as a remote host. Use a workspace-relative output filename on all
platforms; do not pass a Windows drive prefix to tar or add a GNU-only flag to macOS bsdtar.
This follows the official [tar file-name semantics](https://www.gnu.org/software/tar/manual/html_node/file.html).
