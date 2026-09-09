# Research: Fixed Desktop support destinations

- Status: Accepted; typed contracts and Desktop test suite validated
- Date: 2026-09-09
- Scope: Owner-menu Help and Feedback links in the installed Desktop client.
- Boundary: Open only two fixed public HTTPS destinations in the default system browser. Keep
  every new Electron window and every renderer navigation denied. Never append workspace data,
  message text, credentials, query parameters, or arbitrary renderer URLs to a support destination.

## Evidence and candidate review

The existing Desktop application foundation and local-content-protocol entries in
`docs/OPEN_SOURCE_REUSE.md` already select Electron 44.2.0, its sandboxed renderer and a locked
local content origin. The new Owner links currently hit `setWindowOpenHandler`'s deny response,
so they cannot fulfill their intended action.

Reviewed the existing released Electron 44.2.0 shell API and security checklist:

- [Pinned shell API](https://raw.githubusercontent.com/electron/electron/v44.2.0/docs/api/shell.md).
- [Pinned security guidance](https://raw.githubusercontent.com/electron/electron/v44.2.0/docs/tutorial/security.md),
  especially limits on navigation, new windows and untrusted `shell.openExternal` arguments.
- [Release](https://github.com/electron/electron/releases/tag/v44.2.0),
  [MIT license](https://raw.githubusercontent.com/electron/electron/v44.2.0/LICENSE), and
  [BrowserWindow tests](https://raw.githubusercontent.com/electron/electron/v44.2.0/spec/api-browser-window-spec.ts).
- Existing foundation review pins tag object `369b0d9d3afdd5b8c0bdb0ad42391443947a7424`;
  the release resolves to commit prefix `aa650d7`. The dependency remains exactly 44.2.0.
- Reviewed [upstream issue #48388](https://github.com/electron/electron/issues/48388) as a reminder
  that additional Electron windows/title-bar configurations add unrelated platform surface; this
  adapter does not create another window or alter title-bar behavior.

Selected candidate: the existing released `shell.openExternal` main-process API behind an exact
string allowlist and current-main-WebContents identity check. A new link-opening package or generic
IPC bridge adds no necessary capability; the existing official API already delegates browser
selection to the OS on macOS, Windows and Linux. The OpenBot-specific gap is binding its two
product-owned constants to this API while retaining the deny policy. No upstream source is copied
or substantially adapted and no dependency, notice change, executable permission or Worker
capability is added.

## Decision

Accept only `https://github.com/yxflc11/openbot#readme` and
`https://github.com/yxflc11/openbot/issues/new`, byte for byte. Reject credentials, alternate
schemes, ports, extra fragments, parameters, encoded aliases, paths and other hosts. Require the
requesting WebContents to be the current main window at the exact immutable Desktop entry URL,
not destroyed and not loading a different document. New-window attempts always return `deny`;
same-window navigation is prevented before considering this fixed public-link exception. The
main process exposes no general-purpose URL IPC and forwards no form body or window features.
If the OS browser handoff fails, display a fixed error without logging the incoming URL.

## Validation

Test both supported destinations, hostile URL variants, wrong/stale/destroyed/loading source
contents, and external-opener rejection. Run Desktop tests and typecheck. These tests establish
routing and deny boundaries; opening the actual browser remains a native application interaction
check rather than a claim about Windows/Linux real-device behavior.

Validation result (2026-09-09): Desktop typecheck passed; all 26 Desktop test files and 222
tests passed, including the fixed-destination, source-identity and failure fixtures. Native
browser-click verification remains part of the parent Desktop UI acceptance run.
