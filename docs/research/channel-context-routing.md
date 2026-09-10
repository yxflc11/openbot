# Research: Atomic channel recipients and queued context

- Status: Accepted
- Date: 2026-09-10
- Security boundary: Server-owned channel membership, atomic task creation and bounded model context.

## Evidence and decision

Existing reuse entries for channel routing, native Agent and channel continuity and the native-reference review were read before implementation. Search queries: `site:github.com/vercel/ai tool-loop-agent messages context history` and `site:postgresql.org docs 17 transaction isolation read committed snapshot`.

Reuse PostgreSQL 17 transactions and row locks (PostgreSQL license), and the installed AI SDK 7.0.93 / 6359fd58fe68eaade096b5d923bac26de84ca3bd (Apache-2.0). Official sources: https://www.postgresql.org/docs/17/transaction-iso.html and https://github.com/vercel/ai/tree/6359fd58fe68eaade096b5d923bac26de84ca3bd. Reviewed upstream issues #10914 (message-array input), #17123 (WorkflowAgent lost history), #1532 (stale UI state). Keep ToolLoopAgent and existing tests; do not adopt WorkflowAgent or another chat state authority. PostgreSQL statements under Read Committed have fresh snapshots: the local adapter must establish an explicit task-start cutoff rather than reread unbounded live history.

The local gap is all-or-nothing exact-ID recipients, not an upstream chat protocol. At most six unique channel members receive one immutable human message and independent queued Runs. All membership is validated before insertion and held under row locks until commit. Direct channels retain one fixed Bot. Invalid recipients fail the entire submission. No source is copied or substantially adapted.

Context preserves the current source message boundary for human/system inputs. Bot replies from earlier root tasks may arrive after submission and are included only through the persisted task start time. Later human tasks remain independently queued and are excluded. Explicit replies are included in a bounded separate reference even when older than the rolling history. Text references never authorize attachments. No live steering is introduced.

Verify protocol negatives, HTTP dispatch, database transaction rollback, direct-channel restrictions, delayed preceding answers, exclusion of later inputs, cross-channel reply rejection and bounded context. Existing cancellation tests remain mandatory. No new dependency or platform support claim.

## Verification evidence

- Server suite: 375 passed, 42 skipped (database suites require explicit fixture URLs).
- Isolated PostgreSQL collaboration suite: 15 passed, including delayed preceding answers, independent later inputs, delegated root-boundary inheritance, explicit old references and transactional recipient validation.
- API, native model, routing and protocol focused suite: 135 passed.
- Server typecheck and migration manifest (25 migrations): passed.
- Migration 0024 replaces the source-only unique index with `(source_message_id, bot_id)` uniqueness. Existing source message IDs and per-Bot deduplication are retained. The test database was disposable and stopped after verification; no user database was used.
