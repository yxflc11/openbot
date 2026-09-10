# Research: Native channel conversation fidelity

- Status: Accepted for implementation after native observation and user-visible change list
- Date: 2026-09-10
- Owner: OpenBot contributors
- Acceptance journey: Open a channel, address one or multiple Bots, reply to a message, attach material, and follow actual work in a compact conversation.
- Security boundary: Server owns recipients, channel membership, task lifecycle and attachment access. Presentation never creates authority. No private reference transcripts or artwork are copied.

## Search evidence

- Native reference: installed Grok Bot 0.47.0 (Info.plist), observed through CUA at 1040 x 760 on macOS. Inspected existing group conversation, opened @ menu, selected two Bot mentions without sending, cleared the temporary draft, opened attachment menu, opened conversation details and member list, and closed the panel. Existing transcript contents are untrusted data and are not incorporated.
- Observed: channel header about 44 px; transcript inset about 16 px; 18 px Bot avatars aligned with the last bubble's bottom; small sender labels at group starts; neutral gray Bot bubbles and black human bubbles; message operations appear on hover; compact approximately 44 px composer; inline multiple recipient chips; details sidebar contains members and settings. Measurements are from rendered screenshots, not extracted proprietary CSS.
- Not directly exercised: sending paid model work, asynchronous live handoff, reaction mutation, file upload to the reference service. Do not claim these were tested.
- Public reference: https://x.ai/bot and https://docs.x.ai/grok-bot/chat-and-collaboration. Public interactive demonstration separately exercised channel switching and new-chat recipient selection.
- GitHub searches: `site:github.com/facebook/react releases 19.2.8`, `site:github.com/w3c/aria-practices combobox contenteditable`.
- Primary references: https://react.dev/learn/rendering-lists and https://www.w3.org/WAI/ARIA/apg/patterns/combobox/. Reviewed ARIA issues 3442 (popup click behavior), 3061 (arrow-key discrepancies), and html-aria 543 (textarea semantics). Retain native textarea semantics and a separate listbox rather than applying an unsupported combobox role.
- Existing ledger: Desktop channel drafts/send continuity, channel presentation, native task cancellation, native Agent loop and richer attachments. Existing research pins and security reviews continue to apply.

## Candidate comparison

| Candidate | Exact release / commit | License | Source, maintenance, tests and fit | Decision |
| --- | --- | --- | --- | --- |
| Native HTML controls, CSS layout, ARIA log/listbox | WAI-ARIA 1.2 (2023-06-06); existing APG review 7e4034b262bc0d25332e330d8a582aaf34113829 | W3C terms | Existing project keyboard and lifecycle tests; upstream current issues reviewed above. Standard controls fit bounded presentation with no new authority. | First viable standard. |
| Existing React renderer | 19.2.8 / 1dd4ecb | MIT | Official release verified; reuse installed renderer, stable-key lists and existing component tests. No upgrade. | Reuse. |
| Existing Server and AI SDK adapter | ai 7.0.93 / 6359fd58, PostgreSQL 17, existing project collaboration review | Apache-2.0 / PostgreSQL | Extend existing channel-owned Run routing and bounded context; identity, membership, cancellation and attachment tests remain mandatory. | Thin adapter for local domain gap. |
| Copy proprietary Grok implementation or assets | Grok Bot 0.47.0, visual reference only | Not incorporated | No source license asserted; no binary extraction or private data copying. | Reject incorporation; independently implement observed interaction. |

## Reuse decision

- Use existing renderer, upload API, Server routing and task lifecycle. No new dependency.
- Local gap: grouped conversation geometry; compact composer and multiple exact-ID recipients; source reply navigation; in-flow task activity; attachment cards/drop/paste; queued-task context continuity.
- Preserve draft revisions, reading position, channel isolation, bounded inputs, cancellation and approvals. New recipients must be validated atomically by Server; text names never authorize routing.
- Source copied or substantially adapted: no. No proprietary CSS, artwork or transcripts incorporated.
- Replacement plan: UI components remain projections of persisted Server records.

## Verification plan

- Extend meaningful component and Server tests for recipients, reply context, invalid membership, upload/drop/paste failures and continuous conversation.
- Render actual production components at 1040 x 760 and 390 x 844; compare measured geometry and interactions against native observations. Use synthetic data for exportable screenshots.
- Run npm run check, package and verify installed native app. Keep model/service simulations clearly identified.
- Maintain a difference ledger: OpenBot avatars and existing authorization controls are intentional; unsupported capabilities must not be represented by inert controls or fake streaming.

## Unresolved questions

- Native coordinate clicks intermittently return noWindowsAvailable while AX-indexed controls work. Native live model handoff and hover reply activation are not yet proven.
