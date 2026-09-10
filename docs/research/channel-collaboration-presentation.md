# Research: Structured channel collaboration presentation

- Status: Accepted for implementation
- Date: 2026-09-10
- Owner: OpenBot contributors
- Related issue: User-requested same-channel Bot collaboration
- Acceptance journey: An Owner sees which Bot delegates to which colleague, follows the child task, and reads the colleague's answer under its own identity.
- Security boundary: Read-only projection of authenticated Server records; no text-derived identity, authority, task creation, or external publication.

## Search evidence

- Search date: 2026-09-10.
- GitHub queries: `facebook react 19.2.8 release`, React DOM test tree, open React `aria-live` issues, and pinned WAI-ARIA practices tree.
- Primary documentation: [React list keys](https://react.dev/learn/rendering-lists), [WAI-ARIA 1.2 Recommendation dated 2023-06-06](https://www.w3.org/TR/2023/REC-wai-aria-1.2-20230606/), [ARIA23 chat log technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA23).
- Existing reviews: OPEN_SOURCE_REUSE entries for channel conversation continuity, native Agent lifecycle, contextual inspector and accessible profile navigation; existing React component tests and conversation styles.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Native lists and buttons; WAI-ARIA log semantics | WAI-ARIA 1.2, 2023-06-06; APG `7e4034b262bc0d25332e330d8a582aaf34113829` | W3C Software and Document terms | Recommendation, implementation report and APG examples. Current technique was inspected. | Fits current channel log; no new executable dependency or authority. | First viable standard. |
| Existing React renderer | React `19.2.8` | MIT | Published release and license checked; existing OpenBot jsdom tests cover list updates. GitHub test/issue pages returned cache misses, so this review does not claim a new exhaustive upstream issue audit. | Already pinned and accepted in the reuse ledger; stable IDs preserve message identity and no raw HTML is rendered. | Reuse existing dependency, no upgrade. |
| Additional workflow/graph widget | None adopted | Not applicable | Not evaluated as a dependency because standard inline/list controls satisfy the requested journey first. | Would introduce layout/interaction semantics unrelated to this bounded read-only message projection. | Not required. |

## Reuse decision

- Selected option: standard plus existing dependency.
- Use semantic buttons and lists inside the existing polite message log and existing Bot avatars/status labels.
- Exact local gap: map Server-owned `parentRunId`, `rootRunId`, `delegatedByBotId` and `sourceMessageId` to same-channel visible relationships, without parsing message text.
- Source message author is the delegating Bot; child Bot owns its completion message. Missing parent data stays explicitly unavailable instead of inventing a relation.
- Preserve current navigation, Bot identities and typography. Align the bounded channel message presentation to the public reference described below; no full-product pixel-match claim.
- Exit plan: replace the small presentation component if a future shared timeline is adopted; persisted Server relations are independent of the renderer.
- Failure behavior: cross-channel, self-parent, sender-mismatch and cyclic relationships are not presented as valid cooperation. Missing names use neutral fallbacks; links only target loaded authorized tasks.

## Source incorporation

- Source copied or substantially adapted: no.
- Existing React/native controls and OpenBot avatar/status helpers are reused; no external visual assets or source incorporated.
- Existing dependency licenses remain unchanged.

## Verification plan

- Automated: sender/recipient identity, source-message association, inline participant state, child result state, same-channel filtering, invalid/cyclic links, missing records and task-detail callbacks.
- Rendered: desktop and narrow viewport using synthetic records; verify no overflow and visible keyboard focus. Respect existing reduced-motion preferences; no new motion required.
- Documentation: English/Chinese feature notes distinguish delegated tasks from native computer authority and from unverified pixel matching.
- Support: browser UI projection and tested synthetic interaction only; backend execution is verified separately.

## Public Grok Bot reference examined before visual adjustment

- Reference: [xAI Grok Bot product page](https://x.ai/bot), accessed 2026-09-10 in Chrome at 1470 × 835. The page is a current public demonstration, not a versioned application binary; no unavailable commit is claimed.
- Observed hero conversation: white transcript surface, pale gray rounded Bot message bodies, black right-aligned human body, compact composer, and small Bot identities. A centered attribution line identifies messages supplied by other Bots. The “Connect the Bots” example uses compact colored identities with a short handoff status such as “Asking Research…”. No parent-task accordion is demonstrated.
- Resulting local choice: gray Bot bodies and black human bodies, inline delegation recipient/status, independent answering identity, and compact participant links. Keep actual task status and existing reply controls accessible; preserve OpenBot avatars and avoid copying xAI artwork or branding. Product-page mockups do not establish exact measurements for every state, so this is a source-based alignment rather than a verified pixel-perfect reproduction.
- [Official chat/collaboration guide](https://docs.x.ai/grok-bot/chat-and-collaboration), accessed 2026-09-10: messaging combines work and results; group handoffs are asynchronous and text-only. OpenBot's current execution is bounded, sequential synchronous delegation (depth two, four child tasks), so asynchronous parity is explicitly not claimed.
- [Official Bot guide](https://docs.x.ai/grok-bot/bots), accessed 2026-09-10: persistent identity and profile are distinct from conversation history. The reference's shared-computer and public-hosted sharing capabilities are not added by this UI work.
- The learning direction remains credited to Hermes Agent in existing product documentation. This presentation does not add automatic unreviewed memory updates.

## Remaining limitations

- No authenticated Grok Bot application, every screen size, live model results, or asynchronous parity was verified by this visual comparison.


## Rendered verification on 2026-09-10

The flow under test was a synthetic channel containing a parent request, a Bot-authored delegation, and the recipient's answer, followed by opening the child task. A temporary Vite fixture rendered the real components and production styles with synthetic API replies at `http://127.0.0.1:5198/`. The Browser plugin/skill was absent, so the available bundled Playwright and headless Chrome were used; the official reference was separately inspected through CUA Chrome. No dependency was installed.

Chrome at 1280 × 900 and 390 × 844 rendered meaningful channel content without framework overlays, horizontal document overflow, page errors or console errors. Clicking the recipient task control produced the exact child ID callback. Separate top/latest narrow screenshots showed the sender and recipient messages. Existing OpenBot avatar shape, explicit task metadata, composer controls and navigation remain intentional differences from the public xAI demonstration. This is synthetic UI evidence, not a real model run.
