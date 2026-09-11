# Research: Channel run progress panel (real Run data only)

- Status: Accepted
- Date: 2026-09-11
- Owner: @yxflc11
- Related issue: DEV-004
- Acceptance journey: Owner opens a channel Run and sees Bot分工, current step, approval wait,
  failed/completed state, and artifact entry points from Server-owned Run / RunProgress /
  RunFrame / collaboration records; computer preview appears only when a real RunFrame exists.
- Security boundary: Presentation-only in `apps/web`. No new Server/protocol/auth. Frames stay on
  existing `/api/v1/runs/:id/frame` URLs. No fabricated progress stages or placeholder screenshots.

## Search evidence

- Search date: 2026-09-11
- GitHub / upstream UI references (presentation only, not copied):
  - [Grok Bot chat & collaboration docs](https://docs.x.ai/grok-bot/chat-and-collaboration) —
    identity and status as observable product language.
    Verified live 2026-09-11 (page title: Message and collaborate / Work with Grok Bot).
  - OpenBot existing `RunInspector`, `RunCollaboration`, `CHANNEL_EXPERIENCE`,
    `docs/research/channel-bot-collaboration.md`, `docs/research/async-collaboration.md`
- Standards: none required (no new network protocol)

## Candidate comparison

| Candidate | Exact release or commit | License | Fit | Decision |
| --- | --- | --- | --- | --- |
| Compose local panel from existing domain types | OpenBot `@openbot/domain` Run/RunProgress/RunFrame @ `729c16431057` | MIT | Already on the wire; no lockfile change | **Select** |
| Generic kanban / task-board npm UI kits | none selected — any new UI kit would require a package-lock change (banned for this slice) | n/a | Extra dependency surface for presentation already covered by domain types | Reject |
| Invent synthetic progress / stock screenshots | n/a | n/a | Violates honesty DoD | Reject |

## Reuse decision

- Selected option: local gap — thin React composition over existing projections.
- Why first viable: data already arrives via channel snapshot/SSE; UI only needs clearer structure.
- Exact gap: inspector hid the computer section when no frame; collaboration list showed status but
  not role/approval/result entry clearly; no dedicated tested panel module.
- Failure behavior: missing frame → explicit empty state; missing role → “未指定职责”; no fake steps.

## Source incorporation

- Source copied or substantially adapted: no
- Required notice: n/a

## Verification plan

- Unit/component tests for panel empty preview, waiting_approval, collaboration roles, artifacts
- App wiring test: `AuthenticatedWorkspace` → `RunInspector` must pass `childRuns` / `botsById` /
  `onInspectRun` (DEV-004-fix)
- `npm run test -w @openbot/web` covering new + RunCollaboration tests
- Docs: CHANNEL_EXPERIENCE EN/ZH note on honest empty computer preview

## Unresolved questions

- `App.tsx` `RunInspector` call site is in scope for DEV-004-fix (wiring + tests).
- ChannelWorkspace message-row progress presentation remains a later contract.
