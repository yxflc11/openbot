# Research: Approved Desktop workspace refresh

- Status: Implemented; local checks passed, native CI packages pending
- Date: 2026-09-09
- Owner: @yxflc11
- Acceptance journey: navigate channels and direct Bot conversations, address a Bot inline,
  attach bounded text and request reviewed skills, then enter full-window settings/plugins.
- Security boundary: Server owns channel identity, task routing, skill verification and approvals.
  A composer selection is a request, never a permission grant. Sharing is an explicit local
  conversation copy; no public URL or automatic transcript publication is introduced.

## Search evidence

Reviewed existing Desktop channel workspace, contextual inspector, conversation continuity,
workspace preferences, native navigation, installable delivery and reviewed skill content entries
in `docs/OPEN_SOURCE_REUSE.md`. Base OpenBot: `e8fa933`; integrated main `4367e3d`.
GitHub searches: `site.github.com/facebook/react releases 19.2.8`, WAI APG combobox and menus.

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| HTML controls + React | React 19.2.8 / 1dd4ecb | MIT / W3C document terms | Existing release, DOM implementation, APG examples and issue #2962 reviewed | Native details, dialog, textarea, file input; no new dependency or executable content | Reuse |
| Electron | 44.2.0 / tag object 369b0d9d3afdd5b8c0bdb0ad42391443947a7424 | MIT | Release, BrowserWindow tests, window options, issue #48388 reviewed | Retain native frame on Windows/Linux and traffic lights on macOS; keep sandbox/fuses | Reuse |
| Existing skill import and catalog | OpenBot e8fa933 | MIT | Digest-bound review and assignment tests exist | UI exposes existing reviewed single-file skills, not a new marketplace or execution authority | Thin adapter |

Sources: [React release](https://github.com/react/react/releases/tag/v19.2.8),
[DOM source](https://github.com/react/react/blob/v19.2.8/packages/react-dom-bindings/src/client/ReactDOMComponent.js),
[license](https://github.com/react/react/blob/v19.2.8/LICENSE),
[APG combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/),
[selection issue](https://github.com/w3c/aria-practices/issues/2962),
[menu button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/),
[Electron title bars](https://github.com/electron/electron/blob/v44.2.0/docs/tutorial/custom-title-bar.md),
[window tests](https://github.com/electron/electron/blob/v44.2.0/spec/api-browser-window-spec.ts),
[overlay issue](https://github.com/electron/electron/issues/48388).

## Decision and exact gap

Use the existing renderer and standard HTML controls. Keep OpenBot wordmark, both panel toggles,
task strip, contextual inspector and typed task API. Group channel title and overlapping avatars
in one disclosure. Replace redundant sidebar actions with a single creation disclosure, plugins,
and Owner. Settings uses its own vertical navigation; plugins occupies the whole window.

Inline addressing resolves only current Server-provided members; selected identity remains a UUID.
Attachments initially accept bounded UTF-8 text/Markdown/CSV/JSON, disclose the limit and serialize
as user-provided task text under the existing 8000-character task limit. Binary/PDF parsing is not
claimed. Skill chips request verified skills already assigned to the selected Bot; the Server
rechecks skills during execution. No imported text is executed by the client.

Use the standard Clipboard API for explicit conversation copy, with a review dialog and selected-text fallback when copying is unavailable. This covers
user-requested sharing without introducing a hosted transcript service or new identity boundary.
No upstream source copied or substantially adapted; existing notices unchanged.

## Verification

Run focused navigation, composer, disclosure, direct-channel, settings and plugin tests, then
`npm run check`. Inspect actual Mac build and isolated QA flows with both sidebars, collapsed
layouts and a 960x640 window. Follow with Windows and Linux runtime contract checks and native CI
packages. CI compilation is not a claim of real-device installation, Wayland or accessibility
conformance. Preserve profile data during installation. English/Chinese delivery docs maintained.

## Local acceptance evidence (2026-09-09)

- `npm run check` passed after the final platform shortcut and material controls, including
  typechecking, tests, formatting and production builds. Desktop: 26 files / 222 tests.
- The direct-conversation integration test exercised concurrent creation against a disposable
  PostgreSQL instance; the same test is included in hosted CI.
- Chrome inspected the built renderer with isolated fixture data and explicit darwin, win32 and
  linux runtime metadata. At 960 x 640, workspace navigation, both collapsed panels, plugin
  return navigation and vertical settings remained usable. The fixture is not native OS evidence.
- Composer mention selection, reviewed-skill chips, singleton direct navigation, Owner navigation
  and conversation sharing preview were exercised. IME composition and stale Bot routing have
  regression tests.
- The Mac application was packaged and ad-hoc signature verification passed. Profile and prior
  app were backed up before replacement. Native relaunch is waiting for user completion of a
  macOS authentication prompt; no claim of completed native startup is made at this checkpoint.
- Windows/Linux native compilation and installers are delegated to the repository CI matrix.
  No Windows/Linux physical-device, Wayland or accessibility certification is asserted.
