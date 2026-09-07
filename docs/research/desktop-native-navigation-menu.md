# Research: Native Desktop navigation menu

- Status: Accepted for the approved first-round Desktop refinement
- Date: 2026-09-05
- Owner: OpenBot maintainers
- Related issue: User-approved Desktop experience proposal, first round
- Acceptance journey: A Mac user finds Chinese application menus, uses native text editing and window shortcuts, and invokes the same conversation, settings, history, and panel actions available in the toolbar.
- Security boundary: Native commands carry one fixed presentation-only enum to the active local renderer. Only the trusted main frame can publish a strict four-boolean availability snapshot. Neither direction accepts paths, URLs, scripts, accelerators, credentials, or Server commands; Server authorization remains unchanged.

## Search evidence

- Search date: 2026-09-05.
- GitHub queries: `repo:electron/electron is:issue is:open menu accelerator`; Electron `v44.2.0` menu roles, menu tests, release and license.
- Primary documentation: [Electron Menu](https://www.electronjs.org/docs/latest/api/menu), [MenuItem](https://www.electronjs.org/docs/latest/api/menu-item), [keyboard shortcuts](https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts), and [Apple native menu organization](https://developer.apple.com/documentation/swiftui/building-and-customizing-the-menu-bar-with-swiftui).
- Existing entries checked: Desktop application foundation, local content protocol, Server connection, presentation preferences, and native sidebar material in `docs/OPEN_SOURCE_REUSE.md`; `desktop-application-foundation.md` and `desktop-sidebar-material.md`.
- Exact source inspected: Electron [menu roles](https://github.com/electron/electron/blob/v44.2.0/lib/browser/api/menu-item-roles.ts), [menu tests](https://github.com/electron/electron/blob/v44.2.0/spec/api-menu-spec.ts), [menu item tests](https://github.com/electron/electron/blob/v44.2.0/spec/api-menu-item-spec.ts), and [MIT license](https://github.com/electron/electron/blob/v44.2.0/LICENSE).
- Open issues reviewed: [accelerator localization #1632](https://github.com/electron/electron/issues/1632), [left/right modifiers #38672](https://github.com/electron/electron/issues/38672), [frameless mnemonic access #43405](https://github.com/electron/electron/issues/43405), and [zoom targeting webviews #28068](https://github.com/electron/electron/issues/28068). This slice uses ordinary Command modifiers, retains native macOS window controls, and permits no webviews. Native key-glyph localization remains controlled by Electron/macOS.

## Candidate comparison

| Candidate | Exact release or commit | License | Maintenance and tests | Platform/API/security fit | Decision |
| --- | --- | --- | --- | --- | --- |
| macOS native menus through the already installed Electron Menu API | Electron 44.2.0, release commit `aa650d7` | MIT; Apple API terms | Released 2026-09-04; upstream tests cover template validation, role accelerators, native/non-native role execution, explicit submenu overrides, and application-menu registration | Preserves AppKit editing responders and native window behaviors; custom commands need a small trusted bridge | Select the existing dependency as the standard-menu adapter |
| Renderer-only keyboard handlers and custom menu bar | Existing React 19.2.8 | MIT | Existing renderer tests are available, but browser handlers cannot populate the macOS application menu | Duplicates native editing behavior and loses menu discoverability | Keep only toolbar controls/web fallback; not the desktop menu implementation |
| Electron default `viewMenu` and default app menu | Electron 44.2.0 | MIT | Covered in upstream menu-item specs | Includes Reload, Force Reload, and Developer Tools by default, which is broader than the approved production shell behavior | Use an explicit allowlisted template instead |

## Reuse decision

- Selected option: Native platform standard through the existing released dependency, with a thin OpenBot adapter.
- Why first viable: Electron already provides Chinese labels with native standard roles and familiar shortcuts, so no menu dependency or native fork is needed.
- Exact local gap: OpenBot destinations and history availability are renderer state. A fixed enum and an exact four-boolean snapshot connect that state to the native menu without adding application authority.
- Lifecycle: Custom actions start disabled, refresh on window focus, and reset after renderer navigation, crash, or window replacement. Click-time validation rejects a destroyed, unfocused, loading, or non-local main window.
- Upgrade/exit: Keep Electron pinned by the existing lockfile. Rerun contract/menu tests and native macOS smoke checks when upgrading; delete the adapter if the shell is replaced.
- Failure behavior: Missing bridge, malformed state, stale snapshots, or an unavailable renderer cannot dispatch an action. Standard Edit/View/Window roles remain implemented by Electron. No reload or developer-tools role is added.
- Accessibility/material: Menu work does not alter `SidebarMaterialController`, native traffic lights, Reduce Transparency/High Contrast fallback, or the opaque main content.

## Source incorporation

- Source copied or substantially adapted: No. Declarative menu roles and API calls are used through the public API; no upstream implementation is copied.
- Required notices: Existing Electron dependency notices remain the applicable notice location.

## Verification plan

- Automated: Fixed command inventory, Chinese menu grouping, standard role and shortcut coverage, absence of reload/developer tools, strict snapshot validation, correct enablement transitions, and dispatch lifecycle checks.
- Negative: Reject extra/missing/non-boolean snapshot fields; no actions for missing, destroyed, unfocused, loading, foreign-origin, or replaced renderers; existing trusted-frame IPC tests remain applicable.
- Devices: macOS arm64 Preview after the combined renderer build; Windows/Linux template tests do not constitute device support claims.
- Documentation: Parent task updates the bilingual Desktop guide and reuse ledger together with the complete first-round UI.
- Support level: Bounded unit/type verification plus the eventual local macOS Preview smoke check; no expanded distribution or platform conformance claim.

Implementation verification on 2026-09-05: 41 focused tests passed across native navigation,
sandboxed command delivery, trusted IPC senders, sidebar accessibility material, and renderer
security policy. Desktop TypeScript checking and lint of the changed implementation/tests passed.
The parent task performs the combined Preview build and native interaction smoke check.

## Unresolved questions

- None for this approved slice. Attachment upload, inference, stop/retry, global shortcuts, and arbitrary menu customization remain outside the first round.
