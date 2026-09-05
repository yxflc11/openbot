# Research: Channel-first Desktop inspector

- Status: Implemented; focused renderer verification passed
- Date: 2026-09-05
- Owner: @yxflc11
- Related issue: Approved Desktop toolbar, composer, and navigation proposal
- Acceptance journey: Open a channel and immediately see its approvals, current task progress,
  and recent results; expand workspace totals only when needed.
- Security boundary: Read-only projection of the authenticated Server snapshot. Approval
  decisions retain the existing Owner command and `ApprovalCard`; no additional authority,
  routing, accounting, or task execution is introduced.

## Search evidence

- Search date: 2026-09-05.
- GitHub queries: `site:github.com/whatwg/html details summary open issues disclosure` and
  `site:github.com/facebook/react releases v19.2.8`.
- Primary references: [HTML details and summary](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-details-element),
  [React list projection](https://react.dev/learn/rendering-lists),
  [React 19.2.8 release](https://github.com/react/react/releases/tag/v19.2.8),
  [DOM implementation](https://github.com/react/react/blob/v19.2.8/packages/react-dom-bindings/src/client/ReactDOMComponent.js),
  and [MIT license](https://github.com/react/react/blob/v19.2.8/LICENSE).
- Open issue reviewed: [WHATWG #8707](https://github.com/whatwg/html/issues/8707) describes text
  selection activating a summary. Keep the summary short, with no nested controls or selectable
  data. The native element owns disclosure state and keyboard activation.
- The upstream React test file could not be retrieved in this environment; local `ContextRail`
  and `ApprovalCard` interaction tests are available and will cover the changed projection.
- Existing evidence checked: `docs/OPEN_SOURCE_REUSE.md` Desktop channel workspace and usage
  panel entry, `docs/research/desktop-usage-panel.md`, `ContextRail`, `ApprovalCard`, `run-state`,
  and domain `Run`, `Approval`, `Artifact`, `RunProgress`, and `WorkspaceSnapshot` at OpenBot
  `14e41ae78a35cd6a6b52de25a4e60300c2fe993d`.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Native HTML disclosure and existing React | HTML living standard reviewed 2026-09-05; React `19.2.8` / `1dd4ecb` | WHATWG document terms; MIT | Current pinned renderer, DOM source, release and open issue reviewed; existing local interaction harness | Native keyboard disclosure, no new package or state store | Select |
| Existing authenticated snapshot adapter | OpenBot `14e41ae78a35cd6a6b52de25a4e60300c2fe993d` | Existing project license | Domain associations and existing task/approval tests inspected | All required channel, task, approval, artifact, and progress associations already exist | Select a thin projection |
| Additional dashboard or accounting package | None required after the standard and existing adapter satisfy the scope | Not applicable | No new dependency selected | Cannot supply missing authoritative Token data | Do not add |

## Reuse decision

- Selected option: native HTML semantics and the existing React snapshot projection.
- Exact gap: order the inspector by the current conversation and disclose workspace-wide
  totals as secondary information. Show the latest matching progress message for an active run.
- Channel membership is checked on every scoped run. Approvals use their explicit channel;
  a conflicting known run association excludes the approval, but an approval is retained when
  its run has fallen outside the bounded recent-run snapshot. Progress must match both run and
  channel. Artifacts are only reached through visible scoped runs.
- Failure behavior: an unknown or empty channel does not fall back to another channel's data.
  Missing Token data remains unavailable, never zero or an estimated daily total. Statistics
  describe the current bounded snapshot, not all-time activity.
- Replacement plan: consume authoritative usage records only after a reviewed Server schema
  provides them. No new frontend data authority is established here.

## Source incorporation

- Source copied or substantially adapted: no upstream source copied.
- Existing OpenBot components are refactored in place; no dependency or notice changes.

## Verification plan

- Focused renderer tests: channel changes exclude unrelated tasks, approvals, progress and
  artifacts; pending approvals outside the recent-run sample remain visible; conflicting
  associations are rejected; latest progress and results are ordered without snapshot mutation.
- Empty state, unavailable Token data, native disclosure, real snapshot counts and existing
  approval/inspection commands are covered. Parent task verifies rendered Desktop layouts.
- Verification result: `ContextRail` and `ApprovalCard` passed 8 focused tests; scoped Biome
  checks passed. Web typecheck reported only concurrent changes outside these files at the
  time of this check; the parent task performs the final integrated typecheck and full check.
- User-visible documentation and Chinese translation are maintained by the parent task.
- Evidence permits renderer projection claims only, not model inference or Token accounting.

## Unresolved questions

- Token accounting remains dependent on future authoritative Server usage records.
