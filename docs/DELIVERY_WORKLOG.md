# Usable Agent delivery work log

Started 2026-09-07 15:54 UTC (23:54 Asia/Shanghai), from main `8868da1`.
The requested working window is at least four hours. Entries record actual work and grouped
validation; elapsed time alone is not evidence of completion.

| Priority | Project | Acceptance | State |
| --- | --- | --- | --- |
| 1 | Download, install, model setup | Durable versioned downloads, install path, persistent model configuration | Local checks and all 9 hosted jobs passed; public release pending |
| 2 | Useful tool task and file delivery | Scoped source reading produces a downloadable report | Implemented; full check, 12 PostgreSQL tests and actual browser download passed |
| 3 | Execution experience | Bot context, understandable execution state, stop/recovery and usage bounds | Implemented; full check, 16 database tests and actual browser stop/resubmit/usage passed |
| 4 | Knowledge in execution | Reviewed skills/memory influence tasks, with provenance and review boundaries | Reviewed-memory loop implemented; executable skill bodies remain pending |
| 5 | Broader ecosystem | Messaging, isolated delegation, more execution environments | Pending; ordered after core journey |

## Evidence journal

- 15:54–16:02 UTC: confirmed clean implementation worktree and merged main; created
  `codex/usable-agent-delivery`. Reviewed the existing packaging, release, container and model
  configuration boundaries. The user checkout and its unrelated image remain untouched.
- Research before implementation: [installable delivery](research/desktop-installable-delivery.md).
- 16:02–16:35 UTC: implemented native installer adapters, source/checksum-gated draft release,
  macOS/Linux and Windows bootstrap scripts, four-language README entry, bilingual installation
  guide and persistent private model-directory initialization. `npm run check` passed. Actual
  macOS DMG creation plus read-only mount/ASAR/fuse/native executable/license checks passed.
  The first DMG trial exposed a nested-app path error; the adapter was corrected and the actual
  mounted structure is now checked during every macOS installer build. First verified local DMG size:
  191,019,942 bytes, SHA-256 `3c42b0d5cf8824352615245c5b6ce003786bd2607b7e718b411222aa4678fd6c`.
  Public release remains pending: native dependency/source correspondence and real-device/signing
  evidence are separate gates. Local fixtures made no paid provider calls.

## Validation policy

Complete each project, then run its meaningful tests and the repository check. Re-run only for
changes, failures or unresolved concerns. Keep mocked provider evidence distinct from live paid
provider evidence, and package builds distinct from real-device certification.

- 16:35–16:59 UTC: hosted packaging exposed an incomplete npm Electron cache notice path on all
  three platforms. Copying notices from the runtime actually extracted by Packager fixed it.
  Commit ead6c8f passed all 9 CI jobs in run 34144512831, including all three native installers and
  both container architectures. No public Release was published.
- 16:45–17:22 UTC: implemented explicit task URL reading and transactional Markdown reports,
  authenticated downloads and shared file cards. Research preceded implementation. Full repository
  check passed; 12 disposable PostgreSQL integration tests passed; production npm audit found zero
  vulnerabilities. Actual built UI with real Server/database passed login, task submission, report
  download (UTF-8 filename/provenance), unauthenticated 401, reload retention, 1280x900 and 390x844
  layouts, zero page errors. Model and source responses in this journey were deterministic fixtures.
  Browser QA found and fixed Chinese punctuation in task URL extraction.
- Live source attempt: local DNS resolves example.com and rfc-editor.org into reserved 198.18.*
  addresses. The reader rejected both before connecting as designed. Public-network HTTPS success
  remains unverified in this proxy network; the private-address denial must not be weakened.

- 17:24–17:33 UTC: native-shell review found its intentional global browser-download denial. Added
  an artifact-UUID-only main-process save adapter with authenticated bounded Markdown fetch, native
  save dialog and exclusive new-file creation. Full check passed; actual Electron at openbot://app
  exercised renderer/preload/main/Server/disk, saved matching provenance and refused overwrite.
  QA intercepted only the native dialog selection, so this is not manual OS-dialog certification.

- 17:34–18:02 UTC: completed Bot role context, durable Owner cancellation, explicit new-task
  resubmission, provider-reported usage and fixed failure codes. Full check and all 16 PostgreSQL
  tests passed. Built browser verified context, 300/240 reported tokens, cancellation during model
  work, distinct resubmitted task/history and narrow layout, with zero page errors.
- The P2 credential scan found only a synthetic credential URL in a negative test. Replaced the
  literal with runtime construction and rewrote the two unmerged P2 commits without relaxing the
  scanner. Full offline historical scan passed; commit 268063c passed all 9 hosted CI jobs in
  run 34149581888.

- 18:02–18:29 UTC: added explicit default-off model sharing, bounded frozen memory snapshots,
  successful-task candidate lessons, Owner edit/accept/reject and source/revision audit. Full check
  passed; all 273 Server tests passed with 22 real PostgreSQL integration cases enabled. Actual
  browser verified proposal editing, acceptance, next-task use, private/revoked exclusion, reload
  and desktop/narrow layouts, zero page errors. No live paid model calls or autonomous skill claim.
- P3 commit 4a39d5c passed all 9 hosted CI jobs in run 34149990564.

- 18:29–18:49 UTC: integrated pinned OpenRouter 3.0.0, metadata-only credential/model verification,
  fixed routing restrictions and existing Agent lifecycle/usage. Added the missing Web model-settings
  sidebar entry while preserving workspace drafts. Full check and zero-vulnerability production
  audit passed; actual built Web/Server/database verified save/reload/secret-free summaries and
  desktop/narrow layouts. Public model metadata returned HTTP 200; all inference remained fixtures.
- P4 commit 74d7819 passed all 9 hosted CI jobs in run 34151847897.

- 18:49–19:05 UTC: hardened installer recovery and streamed Windows downloads. Full repository
  check passed; real Linux fixtures verified failed-copy cleanup, retry and concurrent-target
  preservation. Nine offline PowerShell 7.5.0 fixtures passed, including redirect denial/count,
  streamed size limits, existing-file preservation and cancellation before/during body transfer.
  Native Windows CI now runs the fixtures under both Windows PowerShell and pwsh.
- OpenRouter commit 078bba1 passed all 9 hosted CI jobs in run 34153185480.

- Final hardening: body-transfer aborts now retain fixed timeout/Server-denial categories and
  discard upstream stream errors. The full check passed, including three new body-stream cases.
  Ubuntu CI exposed a coreutils no-clobber exit-code difference; both Linux behaviors now retain
  the concurrent directory and clean staging. The portable matrix now explicitly runs bootstrap
  tests, including Windows PowerShell and pwsh. Rebuilt the full local macOS DMG with all features;
  mount, ASAR, fuse and native-resource checks passed. This local build has no Worker companion;
  the native CI package builds and includes it.

- 19:14–19:28 UTC: final packaged-ASAR QA reproduced an Electron SSE lifecycle issue after repeated
  navigation: stale streams occupied connection slots and ordinary requests timed out. Reviewed
  pinned Electron source and upstream issue 47097 before adding single-window stream ownership.
  Full check passed. Rebuilt DMG/ASAR then passed the complete native memory-review/use/revoke flow,
  four unique report tasks separated by reloads, exclusive report saving, OpenRouter save/reload,
  four further reloads and zero page errors. QA overrides only the application identity/data path
  and save-dialog selection while loading the built ASAR; it is not uninstrumented signed-app evidence.
- Commit 3f8e38b passed all 9 hosted jobs in run 34154753020, including the explicit native bootstrap
  lane (Windows PowerShell and pwsh). Stream-lifecycle commit verification follows separately.

- Final runtime commit cb718fc passed all 9 hosted CI jobs in run 34155768881. Three installer
  artifacts and three portable-bundle artifacts are available, each retained for 14 days.
