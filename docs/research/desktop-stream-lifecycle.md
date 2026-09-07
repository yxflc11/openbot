# Desktop event-stream lifecycle

Reviewed 2026-09-08 before implementation. Existing reuse entries: Desktop foundation, Server
proxy and desktop conversation continuity. This extends their single-window lifecycle only.

## Evidence

Actual Electron 44.2.0 ASAR QA completed memory review, use and revocation, then timed out after
repeated navigation/reload. Instrumented fixture requests showed successful SSE headers but later
ordinary API requests queued until their 30-second deadline. Server remained healthy.

Reviewed [Electron issue 47097](https://github.com/electron/electron/issues/47097), its reproduction
and closed-not-planned state; searched GitHub `repo:electron/electron protocol.handle cancel stream`,
including maintained open PRs 53263 and 53220. Inspected released 44.2.0
`lib/browser/api/protocol.ts` at tag object `369b0d9d3afdd5b8c0bdb0ad42391443947a7424`, MIT.
Its Request construction does not connect a renderer cancellation signal. Native relay optimization
requires an untouched fetch Response; OpenBot reconstructs responses to filter credential/private
headers. Copying undocumented internal `__fetch` state or relaxing the header boundary is unsuitable.

## Decision

The first viable option is standard AbortController with a thin existing-proxy lifecycle adapter.
No dependency, native protocol fork or upstream source is copied. Retain one workspace and one
channel SSE connection for the existing single main window; a new stream replaces and aborts its
previous slot. Abort both on main-frame navigation, renderer termination, window close, Server
switch and application quit. Bound only the two documented event endpoints; ordinary requests,
credential ownership, origin policy, filtering and redirect denial keep their current contract.
This is connection cleanup, not task cancellation or authorization. Multi-window support would
require one independently scoped registry per window before expansion.

## Verification

Test slot replacement, independent workspace/channel slots, disposal and non-event requests with
real AbortSignals and ReadableStream fixtures. Re-run actual packaged-ASAR navigation/reload and
subsequent unique task submission, plus report saving and model settings. Require full repository
check and native CI. Keep the QA identity/save-dialog wrapper distinct from uninstrumented signed
application certification.

Verification completed: full repository check passed; rebuilt macOS DMG passed its mount/ASAR/fuse
checks. Actual ASAR with isolated QA identity passed reviewed-memory use/revocation, four unique
report tasks after separate reloads, native exclusive save, OpenRouter settings save/reload and four
additional reloads with zero renderer errors. No paid inference or real-device signing claim.
