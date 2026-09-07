# Research: Desktop workspace preferences

- Status: Accepted
- Date: 2026-09-05
- Owner: OpenBot maintainers
- Acceptance journey: Toggle the information panel from the toolbar, change presentation and chat preferences in Settings, and retain those choices after reopening this Desktop profile.
- Security boundary: Only allowlisted, non-secret presentation values belong in browser storage. Server identity, model keys, authorization, tasks, and audit remain Server-owned. Storage failure preserves an in-memory choice and discloses that it was not saved.

## Search evidence

- Search date: 2026-09-05.
- GitHub queries: `facebook/react useSyncExternalStore 19.2.8`; `sindresorhus/electron-store v11.0.2`.
- Standards and primary documentation: [HTML Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html), [WAI-ARIA disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/), and [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore).
- Existing entries reviewed: Desktop channel workspace, integrated Desktop onboarding, application foundation, and Web component interaction tests in `docs/OPEN_SOURCE_REUSE.md`; `desktop-channel-layout.md` and `desktop-integrated-onboarding.md`.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| HTML Web Storage and native disclosure buttons | Living standard reviewed 2026-09-05; WAI-ARIA APG reviewed same date | WHATWG / W3C document terms | Browser implemented standards; exceptions and cross-document storage events are documented | Fits profile/origin-scoped non-secret preferences; no filesystem bridge | Select standards first |
| React external store subscription | Existing React 19.2.8 | MIT | Reviewed public hook/RFC, changelog, issue #24508 (old subscription change) and #37313 (React Native Compiler; this app uses neither Native nor Compiler); upstream external-store tests and cached-snapshot contract | Existing browser renderer dependency; subscribe with stable snapshots and event cleanup | Reuse public hook, no extra package |
| electron-store | v11.0.2, e1470fd | MIT | Reviewed repository, release, CI and issue #298 (ESM/CommonJS initialization) | Maintained and fits Electron 30+, but adds privileged persistence IPC for values already supported by Web Storage | Not needed after viable standard |

## Reuse decision

- Selected option: standard plus the existing React public API.
- Why first viable: localStorage already scopes these cosmetic choices to the isolated Desktop renderer profile; native buttons implement panel disclosure without a widget dependency.
- Exact local gap: OpenBot's small preference schema, cached store adapter, native material preference synchronization, navigation, and categorized settings composition.
- Upgrade/exit: version the storage key; discard malformed/oversized data; retain explicit defaults; migrate only known fields. No access to private React internals.
- Failure behavior: defaults for invalid persisted data; storage errors keep the current in-memory value and show a persistence warning. Native material failures fall back to an opaque sidebar. System reduced transparency takes priority.

## Source incorporation

- Source copied or substantially adapted: no.
- Files and upstream locations: only public browser/React APIs are used; screenshots are visual references, not copied assets or code.
- Required copyright or license notice location: existing dependency notices; no new incorporated source.

## Verification plan

- Automated: preference validation, persistence failure and subscriber behavior; existing component suite; native material contract tests; `npm run check`.
- Interaction: open/close/reopen panel including reload; navigate all destinations and settings sections; save font/density/send-shortcut preferences; IME and Shift+Enter preserved; settings controls work without native material support.
- Platforms: rendered Chromium checks at desktop/compact/mobile sizes and local arm64 macOS packaged Preview. No untested cross-platform material claim.
- Documentation: update Desktop onboarding capability notes and Chinese translation, and reuse ledger in both languages.

## Unresolved questions

- No dark appearance is offered until the complete workspace has been implemented and checked in that appearance.
- Token accounting still requires Server usage records; presentation preferences do not estimate or invent usage.
