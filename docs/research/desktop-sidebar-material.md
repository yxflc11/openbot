# Research: native Desktop sidebar material

- Status: Accepted for isolated macOS Preview verification
- Date: 2026-09-05
- Owner: OpenBot maintainers
- Acceptance journey: Enable sidebar translucency in settings, keep the chat and details opaque,
  then disable it or enable macOS Reduce Transparency and receive an opaque, legible sidebar.
- Security boundary: This is a local presentation preference. The sandboxed renderer may supply
  one strict boolean to a trusted-main-frame IPC handler; it cannot select a window, material,
  native theme, color, command, path or system preference. Server authority is unchanged.

## Search evidence

- GitHub queries on 2026-09-05: `repo:electron/electron vibrancy sidebar backgroundColor`,
  `site:github.com/electron/electron/issues vibrancy reduce transparency`.
- Primary documentation queries: Electron `setVibrancy`, `nativeTheme.prefersReducedTransparency`,
  and Apple Human Interface Guidelines materials, sidebars, and accessibility.
- Existing reuse entries checked: Desktop application and language foundation, Integrated Desktop
  onboarding, Desktop channel workspace and usage panel. Their accepted title-bar and preview
  boundaries remain; the user's new request explicitly adds sidebar translucency.
- [Electron 44.2.0 release](https://github.com/electron/electron/releases/tag/v44.2.0), pinned by the
  repository lockfile; inspected its exact
  [BrowserWindow documentation](https://github.com/electron/electron/blob/v44.2.0/docs/api/browser-window.md),
  [nativeTheme documentation](https://github.com/electron/electron/blob/v44.2.0/docs/api/native-theme.md),
  [macOS implementation](https://github.com/electron/electron/blob/v44.2.0/shell/browser/native_window_mac.mm),
  [window tests](https://github.com/electron/electron/blob/v44.2.0/spec/api-browser-window-spec.ts),
  [native-theme tests](https://github.com/electron/electron/blob/v44.2.0/spec/api-native-theme-spec.ts),
  installed TypeScript declarations, and MIT license. `sidebar` maps to the native sidebar material
  with behind-window blending; the default material state follows window activation. Upstream
  tests exercise set/change/remove and preservation of the web viewport. Native-theme tests cover
  the reduced-transparency boolean and theme-update events. The existing Electron package is
  maintained and needs no additional dependency or native extension.
- [Apple materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials)
  and [sidebars guidance](https://developer.apple.com/design/human-interface-guidelines/sidebars)
  recommend semantic materials, legibility over variable backgrounds and user-customizable panes.
  We use the standard sidebar material; we do not claim native Liquid Glass or a SwiftUI sidebar.
- [Electron issue 31461](https://github.com/electron/electron/issues/31461) documented a historical
  opaque-web-background regression; it is closed. [Issue 19765](https://github.com/electron/electron/issues/19765)
  describes older CSS backdrop-filter/vibrancy compositing trouble. Do not layer CSS blur over the
  native material, and validate actual rendering instead of assuming constructor options suffice.
- [Issue 46455](https://github.com/electron/electron/issues/46455) records historical macOS test
  failures with reduced motion/transparency and is closed. Accessibility overrides are part of our
  own tests and manual checklist, not grounds to change the user's system preferences for QA.

## Candidate comparison

| Candidate | Exact pin / license | Platform, maintenance and security fit | Decision |
| --- | --- | --- | --- |
| Existing native sidebar material through Electron | Electron 44.2.0 / MIT; AppKit platform API | Maintained released API; no native addon; retains native controls and resize behavior | Select with a bounded adapter |
| CSS translucent background / backdrop filter alone | CSS Backgrounds and Filter Effects standards | Works within the web surface but cannot blur the desktop behind an opaque native window | Use only renderer tint; insufficient alone |
| Transparent frameless window or custom native extension | Additional implementation not selected | Would add window-control, hit-test, signing and native lifecycle responsibilities already covered by Electron | Reject; no unmet gap |

## Reuse decision

Reuse `BrowserWindow.setVibrancy('sidebar')` and transparent web-background composition. Do not use
`transparent: true`, custom traffic lights, a frameless window, private APIs or global OS writes.
Keep native chrome and drag behavior. The renderer exposes the material only under the left
sidebar and keeps chat, detail panels, onboarding and settings content opaque. A light application
uses Electron's application-scoped light theme so material and text have compatible contrast;
this does not change macOS's theme. Dark-mode theming is not claimed by this change.

The thin adapter retains the requested local preference separately from effective state.
`nativeTheme.prefersReducedTransparency` or high-contrast mode always yields an opaque fallback.
A fixed state event updates the renderer on native-theme changes and window focus, with no
Electron event object crossing the preload boundary. Both directions carry only allowlisted
status strings. Unsupported platforms and unavailable windows stay opaque. Material changes are
instant, so they respect reduced motion without requiring animation settings or custom timing.
The optional bridge keeps older Desktop/web builds compatible. Upgrade Electron through the
existing packaging path and repeat the native rendering/accessibility checks before expanding
support.

## Source incorporation

- No source copied or substantially adapted. OpenBot calls the existing released APIs.
- Electron's MIT notice remains in `THIRD_PARTY_NOTICES.md` and packaged dependencies.

## Verification plan

- Unit tests: strict boolean input, no mutation for malformed values, native enable/disable,
  reduced transparency and high contrast, platform fallback, window disposal, error fallback,
  event deduplication and restoring the retained choice after an accessibility override.
- Preload validation: bounded argument, exact channels, stripped events, unsubscribe cleanup.
- macOS arm64 Preview: native controls, actual material under the left sidebar, opaque chat and
  details, settings toggle, focus/inactive state, resize, and developer-console errors.
- Do not change global macOS accessibility settings during automated QA. Simulate flags in unit
  tests; native manual settings verification remains explicitly identified if not performed.
- Root task maintains the English and Chinese user documentation and reuse ledger for the full
  navigation/settings change. This evidence permits a local macOS Preview, not other-platform
  translucency or complete accessibility conformance.

## Local automated verification

The focused Desktop material, sandboxed-preload, trusted-sender and Server-proxy suites passed
36 tests on 2026-09-05. The Desktop main-process TypeScript build passed. Tests verify restoration
of the retained preference after both accessibility overrides, opaque fallbacks, exact native
calls, event stripping/cleanup, and the existing automation-route proxy boundary. Live native
appearance verification is part of the root task's combined Preview check.
