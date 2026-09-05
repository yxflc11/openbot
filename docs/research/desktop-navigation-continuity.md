# Research: Integrated Desktop navigation and view continuity

- Status: Accepted
- Date: 2026-09-05
- Owner: OpenBot maintainers
- Acceptance journey: Move between channels, Bots, destinations and Settings without losing channel drafts or reading position; use a stable native-aligned toolbar to navigate and toggle either panel.
- Security boundary: Navigation is presentation state, never Server routing or authorization. Memory is scoped to the authenticated workspace lifetime. Switching Server/Owner, logout or application reload ends that lifetime. Only allowlisted cosmetic panel preferences persist locally.

## Search evidence

- Search date: 2026-09-05.
- GitHub queries: `remix-run/react-router releases navigation history`; `bvaughn/react-resizable-panels releases license keyboard`.
- Primary sources: [React preserving state](https://react.dev/learn/preserving-and-resetting-state), [Apple Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars), [WAI-ARIA toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/), [WAI-ARIA splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/), and the existing [Electron title bar](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar) contract.
- Existing reuse entries reviewed: Desktop channel workspace, native sidebar material, presentation preferences, destination gallery, and Web component tests. Related notes: `desktop-channel-layout.md`, `desktop-workspace-preferences.md`, `desktop-sidebar-material.md`.
- User explicitly approved the first-stage proposal on 2026-09-05: unified toolbar, composer, navigation/draft reliability and contextual task information. Model inference, input attachments, cancellation and idempotent retries remain separate work.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| Existing React public state/ref APIs + native HTML controls | React 19.2.8; HTML/WAI-ARIA documentation reviewed 2026-09-05 | MIT; WHATWG/W3C document terms | Existing dependency suite; official guidance explains keyed remount and preserved parent state; established OpenBot jsdom tests | Covers the view state primitive without document navigation or persistent transcript storage | Reuse existing released dependency and HTML buttons |
| React Router | 8.3.0, release 2edaca7 | MIT | Reviewed repository packages/integration tests/releases and issue #12790 concerning navigation/state timing | MemoryRouter is viable for future path-addressable screens, but this stage keeps one trusted document and needs typed selection history scoped to one authorized snapshot, not URL routing | Defer URL router; keep local mapping between authorized objects and React selection state |
| react-resizable-panels | 4.9.0 | MIT | Reviewed repository/public Separator contract, changelog and discussion #653 (drag direction fixed in4.6.2) | Viable for future draggable splits; user-approved controls require hide/show and responsive window sizing, not a new drag-resize layout engine | No new drag-resize dependency in this stage |
| Electron native title/menu controls | Existing44.2.0 | MIT | Existing trusted IPC/window tests; dedicated menu review in `desktop-native-navigation-menu.md` | Retains OS traffic lights, editing behavior and accessibility while renderer owns content | Continue existing adapter |

## Reuse decision

- Selected option: existing React dependency/public APIs, native HTML buttons, and existing Electron adapter.
- Exact local gap: a bounded typed history of authorized channel/Bot/destination selections, preserving the mounted authenticated workspace while Settings is shown, and coordinating the toolbar/native menu through a fixed command enum.
- History records contain only local object IDs and view names; there is no generic URL navigation, route loader, cross-Origin state or new execution authority.
- Hidden workspace is inert and removed from layout/accessibility while Settings is visible. A changed authentication/Server context unmounts it rather than carrying drafts into another context.
- Defaults and panel-open values remain in the existing strict presentation preference allowlist. No channel text enters localStorage.
- Exit plan: replace the view history adapter with a reviewed URL router when deep links/routes become a real requirement. Tests remain at user-navigation boundaries.
- Failure behavior: unavailable targets cannot confer access; existing Server fetches retain auth enforcement. Native commands default disabled until renderer reports a ready workspace. Missing bridges use ordinary browser keyboard controls.

## Source incorporation

- Source copied or substantially adapted: no.
- No Codex code, artwork or private behavior is incorporated. User screenshots supply layout direction only.
- Required notices: existing React/Electron dependency notices; no added dependency.

## Verification plan

- Deferred-request regressions for per-channel drafts and send continuity are recorded in `desktop-conversation-continuity.md`.
- History back/forward, invalid/duplicate transitions, bounded history, settings return, keyboard/menu commands and new-channel selection tests.
- Rendered checks at960×640 and wide desktop: single-row toolbar, independent panel toggles, fixed far-right inspector action, comfortable text/composer width, no overflow. Mobile regression remains readable.
- Native menu tests preserve editing roles and fail-closed IPC. No live user task or transcript is created by QA.
- `npm run check`; bilingual Desktop/reuse documentation; independent branch and merge-tree verification before handoff.

## Unresolved questions

- Cross-restart private draft persistence and draggable split sizing require separate privacy/layout decisions.
- Input attachments, model inference, user cancellation and safe retry remain outside this approved stage.
