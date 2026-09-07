# Research: Desktop conversation continuity

- Status: Accepted for the approved first Desktop usability round
- Date: 2026-09-05
- Owner: OpenBot contributors
- Acceptance journey: Switch channels or visit settings while writing/sending; return to the correct draft and reading position, with no duplicate submission or cleared newer text.
- Security boundary: Session memory is a presentation cache, never a source of message, routing, Employee or Run authority. Only the existing authenticated Server message API submits work. No retries, cancellation, attachments or model execution are introduced.

## Search evidence

- Search date: 2026-09-05.
- GitHub queries: `facebook react v19.2.8 useSyncExternalStore issues`; `Andarist react-textarea-autosize releases 8.5.9`.
- Primary documentation: [React external stores](https://react.dev/reference/react/useSyncExternalStore), [keyed state and chat drafts](https://react.dev/learn/preserving-and-resetting-state), [HTML textarea](https://html.spec.whatwg.org/multipage/form-elements.html#the-textarea-element), and [CSSOM View scroll geometry](https://drafts.csswg.org/cssom-view/#dom-element-scrollheight).
- Reviewed reuse-ledger entries: Desktop channel workspace, presentation preferences, accessible profile navigation, and web component interaction tests; existing `ChannelWorkspace`, `api` channel SSE adapter and monotonic Run merge implementation.
- Compared [react-textarea-autosize v8.5.9 source](https://github.com/Andarist/react-textarea-autosize/tree/v8.5.9/src), release, MIT license and tests directory. Its [open issues](https://github.com/Andarist/react-textarea-autosize/issues) include zoom scrollbars (#423), forced reflow (#422) and dependency update (#424). The test directory fetch was unavailable in this review; this candidate is not adopted.
- React repository review includes the existing exact 19.2.8 dependency and [external-store RFC](https://github.com/reactjs/rfcs/blob/main/text/0214-use-sync-external-store.md), changelog, and snapshot caching issue [#24508](https://github.com/facebook/react/issues/24508). The remote v19.2.8 source fetch was unavailable; existing reviewed/pinned local React remains unchanged.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Native HTML forms, CSSOM scroll geometry and React external store | Living standards reviewed 2026-09-05; existing React 19.2.8 | WHATWG/W3C terms; MIT | Browser standards, React upstream and local regression tests | Keeps native composition/selection and one workspace-lifetime in-memory store | Selected first viable standard plus thin adapter |
| react-textarea-autosize | v8.5.9 | MIT | Released 2025-03-30; source/tests present; zoom/reflow issues open | Compatible text control, but its hidden measurement machinery and dependency do not solve channel or send ownership | Not needed for bounded 2–8 line textarea |

## Reuse decision

- Selected option: standard and thin adapter, no new dependency.
- Exact local gap: a workspace-owned, bounded session cache with stable immutable snapshots; channel-keyed draft revisions; one in-flight submission per channel across remounts; cached successful results; independent load/send errors; ignored stale read/SSE callbacks after cleanup.
- Textarea sizing uses existing native geometry, min/max line bounds and resize observation; native textarea remains the fallback. Member management uses a native disclosure and existing authenticated join action.
- Cache is limited to 32 visited channels, 200 messages and 50 Runs per channel; one 8,000-character draft per channel. Active, pending, and unsent draft/reply channels are not evicted. At capacity, one transient read-only channel view shows a recoverable limit notice; clearing or sending an older draft frees a slot. Clean evicted entries are closed and cleared. At most eight submissions may remain pending. Workspace disposal clears all caches and prevents queued or late submission callbacks. No transcript/draft is written to disk or localStorage. It ends at logout/profile unmount.
- Network ambiguity is disclosed; failed submission is not retried automatically. Reconnect reads do not clear send failures. Late callbacks cannot mutate another channel.
- Upgrade/exit: retain public component/session interfaces; replace native sizing with a released adapter only if rendered tests prove unsupported requirements.

## Source incorporation

- Source copied or substantially adapted: no.
- Files: OpenBot-only session adapter, channel view and member disclosure.
- Required copyright notices: existing repository MIT notice; no additional source/assets incorporated.

## Verification plan

- Unit regression tests with deferred promises: revision-safe clearing, unchanged draft clearing, independent channels, pending request de-duplication across remounts, failed send preservation and bounded memory.
- React interaction tests: ignored stale reads/SSE, separate load/send errors, restored draft, correct Bot/reply, keyboard composition, and user-controlled latest-message scroll.
- Parent integration: settings preserves session lifetime; channel ID keys reset component effects. Rendered Desktop/browser QA checks textarea growth, toolbar disclosure, long responses and narrow widths.
- User-facing documentation is maintained in English and Chinese by the coordinating change.
- Evidence permits local Desktop/browser UI behavior, not server idempotency, offline sending or reload-persistent drafts.

## Unresolved questions

- Server-side idempotency and model execution remain outside this approved round.
