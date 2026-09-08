# Research: restore the app-owned local session

- Date: 2026-09-08
- Status: Accepted for implementation
- Scope: fix the local macOS Desktop login screen after session expiry; preserve the existing local identity and user data when updating Preview.

## Evidence and upstream review

The running Preview uses the host setup plan and an app-owned PostgreSQL/Server. Its current cookie
store has no retained session. `App.tsx` drops authentication at the fixed expiry and on HTTP 401;
`NativeServerController.start()` immediately returns ready for a live child without logging in again.
The only automatic login occurs during the first start. Consequently reload/expiry can expose a
password that the app generated and the user never chose. The screenshot is the actual local app.
The missing renewal path is confirmed; the original cookie's expiry time is no longer retained.

Reviewed the Integrated Desktop onboarding entry in OPEN_SOURCE_REUSE and its existing research.
Queries: `electron session fetch cookies safeStorage`, GitHub `electron/electron session fetch cookies`.

| Candidate | Exact version | License | Source / tests / issues / fit | Decision |
| --- | --- | --- | --- | --- |
| Electron session.fetch + safeStorage | 44.2.0, release aa650d7 | MIT | [release](https://github.com/electron/electron/releases/tag/v44.2.0), [session](https://www.electronjs.org/docs/latest/api/session), [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage); installed runtime and existing bootstrap tests. Issue [44456](https://github.com/electron/electron/issues/44456) describes older partition-cookie behavior and is closed without a fix; therefore verify the real persistent partition, not just a mocked login response | First viable: reuse installed primitives and existing Server login |
| Existing OpenBot Owner session | 423fd229332c184b788a5abccb50a956602bdf13 | MIT | owner-auth, persistent session store, Origin checks, Desktop private proxy and IPC sender tests | Keep Server authority and its TTL; no new remote credential or refresh-token protocol |
| Global TTL increase / unauthenticated localhost | Not selected | Not applicable | Does not restore expired local identity correctly and changes remote security semantics | Reject |

## Local gap and decision

Add a no-argument trusted IPC operation that can authenticate only the live Server owned by this
Desktop process, only in host mode and only if the current connection still matches. Reuse the
existing local bootstrap identity inside the main process; no password or cookie goes to the renderer.
Bound and deduplicate recovery, and reject stale results after stop, restart or Server switching.
Verify the resulting Server session. Recover local sessions after expiry, 401 and foreground return;
do not replay any failed mutation. Remote/Web login and expiry remain unchanged. An explicit local
logout stays logged out in the window, with a one-click local re-entry action instead of a password.

No upstream implementation copied or substantially adapted. No new dependency. Keep existing notices.
Validation: boundary/concurrency tests, renderer session tests, full npm run check, actual packaged
Electron + local Server with an expired session, reload/relaunch and logout/re-entry. Use an isolated
QA profile for expiry mutation; retain real user data and only replace identified obsolete app files.

## Display name and existing Preview identity

The user also requested the installed name **OpenBot**, without Preview. Electron 44.2.0
[shell/browser/electron_browser_main_parts.cc](https://github.com/electron/electron/blob/v44.2.0/shell/browser/electron_browser_main_parts.cc)
sets the macOS Keychain service/account from the app name before ready (lines 686–687). Renaming
that encryption identity blindly would make the existing bootstrap unreadable.

Use canonical OpenBot package/product naming. When a canonical profile has no saved setup and an
existing Preview profile does, select that existing profile and set its legacy name before ready,
then restore the OpenBot display/menu name after ready. This preserves the existing Keychain
namespace without decrypting/exporting/re-encrypting user secrets or duplicating the database.
A configured canonical OpenBot profile always takes precedence. New users use canonical identity.
No migration of unrelated files and no deletion of the selected data directory. Test selection and
actual packaged launch against the existing profile before removing obsolete application bundles.

## macOS executable display name and Keychain authorization

The installed bundle exposed `openbot` in CFBundleExecutable/CFBundleDisplayName because the shared
package identity used the lowercase CLI executable name. Reviewed installed @electron/packager
20.3.0 (MIT), its macOS plist construction and
[options](https://packages.electronjs.org/packager/v20.0.4/interfaces/Options.html).
Use the product name for the macOS executable; retain existing Windows/Linux executable paths.
This is a packaging correction, with final plist and running-app verification.

The existing profile successfully decrypted and opened its original workspace after the user
authorized Keychain access. The installed local artifact is ad hoc signed, with no TeamIdentifier;
the local codesigning identity query returned zero valid identities. Apple's
[Keychain authorization guide](https://support.apple.com/guide/keychain-access/if-youre-asked-for-access-to-your-keychain-kyca1243/mac)
documents Allow versus Always Allow. Electron's
[signing guidance](https://github.com/electron/electron/blob/v44.2.0/docs/tutorial/code-signing.md)
also identifies Keychain as a signing-sensitive framework. Do not promise prompt-free upgrades
for this development artifact. A stable Developer ID distribution identity is a separate release
prerequisite; do not relax the Keychain ACL, discard encryption, or delete the existing key.

## Validation results

On macOS arm64 with Electron 44.2.0, `npm run check` passed. An isolated real Electron/native
Server/PostgreSQL profile passed initial login, database-expired session plus reload, foreground
recovery, explicit logout plus one-click re-entry, the 12-hour expiry timer, and relaunch with
retained channel data. The QA run reported no renderer page errors.

The final canonical ASAR application passed `codesign --verify --deep --strict` for its ad hoc
signature. Installed CFBundleExecutable and CFBundleDisplayName both equal `OpenBot`. The actual
installed app opened the existing profile, retained its channel and Bot, and reached a synchronized
workspace after restart. The native accessibility surface identifies the application as `OpenBot`.
This validates this local macOS update, not signed/notarized distribution or other platforms.
