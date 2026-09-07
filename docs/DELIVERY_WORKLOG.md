# Usable Agent delivery work log

Started 2026-09-07 15:54 UTC (23:54 Asia/Shanghai), from main `8868da1`.
The requested working window is at least four hours. Entries record actual work and grouped
validation; elapsed time alone is not evidence of completion.

| Priority | Project | Acceptance | State |
| --- | --- | --- | --- |
| 1 | Download, install, model setup | Durable versioned downloads, install path, persistent model configuration | Local checks passed; native CI and public release pending |
| 2 | Useful tool task and file delivery | Scoped source reading produces a downloadable report | Research completed; implementation next |
| 3 | Execution experience | Bot context, understandable execution state, stop/recovery and usage bounds | Pending |
| 4 | Knowledge in execution | Reviewed skills/memory influence tasks, with provenance and review boundaries | Pending |
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
  mounted structure is now checked during every macOS installer build. Final local DMG size:
  191,019,942 bytes, SHA-256 `3c42b0d5cf8824352615245c5b6ce003786bd2607b7e718b411222aa4678fd6c`.
  Public release remains pending: native dependency/source correspondence and real-device/signing
  evidence are separate gates. Local fixtures made no paid provider calls.

## Validation policy

Complete each project, then run its meaningful tests and the repository check. Re-run only for
changes, failures or unresolved concerns. Keep mocked provider evidence distinct from live paid
provider evidence, and package builds distinct from real-device certification.
