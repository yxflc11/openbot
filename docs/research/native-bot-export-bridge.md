# Research: preserve reviewed Bot content selection across the Desktop bridge

- Status: Accepted for implementation
- Date: 2026-09-11
- Owner: @yxflc11
- Acceptance journey: download a Bot with a reviewed, redistributable SKILL.md from the installed Desktop, then inspect the saved package and recipient review state.
- Security boundary: the renderer supplies only the reviewed identity and an optional boolean; the Server binds exact exported bytes, and the native save dialog alone chooses the output path.

## Search evidence and reuse

Reviewed the [portable Bot research](portable-bot-skills.md) and existing reuse ledger before
expanding its native adapter. The actual installed alpha.7 could preview a v2 package but failed
before opening a save dialog. `preload.cts` still rejected every fifth field and projected only the
four v1 identity fields; the Web caller and main-process saver already supported `includeSkillContent`.

Reviewed [Electron context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
and the pinned [44.2.0 contextBridge contract](https://github.com/electron/electron/blob/v44.2.0/docs/api/context-bridge.md).
The bridge supports boolean/object values and recommends a method-specific IPC boundary.
Electron 44.2.0 is the existing maintained MIT runtime, with upstream bridge tests in
`spec/api-context-bridge-spec.ts`; no version or dependency changes are needed. This is a local
field-projection mismatch, not a missing upstream API. The already-reviewed Agent Skills format and
OpenBot v2 package/Server digest validator remain the selected implementations. No fork or broader
IPC API is justified.

## Decision

Keep the four-field v1 request valid. Admit only an optional boolean `includeSkillContent`, preserve
true and false when present, and reject all other keys or value types before invoking the fixed
save channel. The main process independently validates the same request and retains the exact
preview digest, response hash, bounded download, session recheck and exclusive file creation.
Correct the import form's old statement that Bot exports never contain instruction bodies.

## Source incorporation

No upstream source copied or substantially adapted; no new dependency or changed license. The
existing Electron MIT and Agent Skills attribution records remain in place.

## Verification

Run the actual preload source in its existing sandbox harness: v1 identity, v2 true/false, malformed
selection, extra URL/path fields and exact projection. Prove the v2 regression fails before the fix.
Retain main-process reviewed-download and Web/Server tests, full `npm run check`, native CI and a
real installed-Desktop download/import journey. A bridge-unit pass alone is not native acceptance.
Screenshots, synthetic task results and user profile data stay outside the repository.
