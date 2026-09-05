# Research: Desktop usage and activity panel

- Status: Implemented; focused renderer verification passed
- Date: 2026-09-05
- Owner: @yxflc11
- Related issue: Desktop interface refinement requested in the current task
- Acceptance journey: Read a persistent, compact activity panel beside channel chat, distinguish
  unavailable token usage from zero, inspect real recent tasks, and approve an existing request.
- Security boundary: This is a projection of the existing authenticated Server snapshot. It adds
  no inference, accounting, authority, polling, or approval command. Existing approval callbacks
  remain the only path for decisions.

## Search evidence

- GitHub queries: `site:github.com/react/react v19.2.8 test react dom` and
  `site:github.com/whatwg/html dl dt dd accessibility issue`.
- Primary references: [React pure calculation guidance](https://react.dev/reference/react/useMemo),
  [HTML description lists](https://html.spec.whatwg.org/multipage/grouping-content.html#the-dl-element),
  [React 19.2.8 release](https://github.com/react/react/releases/tag/v19.2.8),
  [DOM source at 19.2.8](https://github.com/react/react/blob/v19.2.8/packages/react-dom-bindings/src/client/ReactDOMComponent.js),
  and [MIT license](https://github.com/react/react/blob/v19.2.8/LICENSE).
- Issue review: [React #37100](https://github.com/react/react/issues/37100) documents a development
  Scheduler/jsdom teardown issue, including a reproduction on 19.2.8. Tests must unmount through the
  existing `act` helper. [HTML #1937](https://github.com/whatwg/html/issues/1937) records description
  list grouping; use native `dl`/`dt`/`dd` with `div` groups rather than invented roles.
- Existing evidence checked: `docs/OPEN_SOURCE_REUSE.md` Desktop setup intent, accessible profile
  navigation, and component testing entries; `docs/research/desktop-setup-plan.md`;
  `ContextRail`, `ApprovalCard` and its interaction tests; domain `WorkspaceSnapshot`, `Run`, and
  `ExecutionNode`; Server `listRuns`; renderer `run-state.ts`.
- Baseline inspected: OpenBot commit `7559bab46de87d62b6827e1635f106724c3c4418`. The Server snapshot
  contains at most 50 recent runs and no token/cost fields. Connected nodes are a separate real
  snapshot projection. Counting this sample as all-time or daily usage would be incorrect.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Native HTML semantics and existing React | React `19.2.8`; HTML living standard read 2026-09-05 | MIT; WHATWG standard | Existing pinned renderer, React DOM source and release, upstream issue reproduction, and OpenBot `act`/jsdom interaction tests reviewed | Native buttons and description lists work in the existing Electron and browser renderers; no new effect or permission | Select |
| Existing OpenBot snapshot adapter | `7559bab46de87d62b6827e1635f106724c3c4418` | Existing project license | Server snapshot and renderer state tests already cover task projection and approval mutations | Provides real run state, computer state, and approvals, but no token accounting | Select for recent activity; explicitly mark token data unavailable |
| Additional chart, billing, or model SDK | None added | Not applicable | No candidate is required after standard HTML and existing data satisfy this bounded projection | A library cannot supply absent authoritative usage records; deriving costs from message text would mislead | Defer accounting until Server supplies observed model usage |

## Reuse decision

- Selected option: open HTML semantics, the existing released React dependency, and a thin
  OpenBot snapshot projection.
- Exact gap: a quiet right panel with unavailable input/output token fields, counts labeled as
  recent records, retained approvals, inspectable tasks, and connected computers.
- No duplicated state or effect is needed for inexpensive array filters. Sort copies of terminal
  runs, never mutate the snapshot. Preserve the existing status labels and approval component.
- Replacement plan: consume authoritative token usage once a reviewed Server schema provides it.
  Keep missing data distinguishable from observed zero and define a reporting interval then.
- Failure behavior: absent usage remains an em dash with explanatory text. Reconnecting state is
  visible. Failed and cancelled runs do not count as completed. No synthetic savings or costs.

## Source incorporation

- Source copied or substantially adapted: no upstream source copied.
- Existing OpenBot components are refactored in place; no new dependency or license notice.

## Verification plan

- Focused renderer tests: unavailable usage versus zero; counts from mixed real statuses; sorting
  without input mutation; task inspection; preserved approval decisions; empty computer state.
- Focused verification result: `ContextRail` and retained `ApprovalCard` tests passed (5 tests);
  web typecheck and scoped Biome checks passed.
- Rendered layout verification is performed with the parent task's complete three-column shell.
- User-visible documentation and translations: the parent task maintains the paired Desktop
  interface documents and reuse ledger; this research record is canonical English.
- Evidence permits only the existing renderer and connected-Server state claims. It does not
  establish model inference or accounting support.

## Unresolved questions

- Token accounting requires a future Server record; this panel deliberately makes no estimate.
